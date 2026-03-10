# Challenge – Arquitectura Event-Driven

**Backend NestJS · Frontend Next.js · PostgreSQL · Eventos de Dominio**

---

## Tabla de contenidos

1. [Introducción](#1-introducción)
2. [Diagnóstico del repositorio original](#2-diagnóstico-del-repositorio-original)
3. [Cambios realizados](#3-cambios-realizados)
4. [Diseño basado en eventos](#4-diseño-basado-en-eventos)
5. [Arquitectura del sistema](#5-arquitectura-del-sistema)
6. [Frontend](#6-frontend)
7. [Deploy](#7-deploy)
8. [Cómo ejecutar el proyecto](#8-cómo-ejecutar-el-proyecto)
9. [Conclusión técnica](#9-conclusión-técnica)

---

## 1. Introducción

El objetivo del challenge era evolucionar un backend de e-commerce construido en NestJS hacia un modelo **event-driven**, realizando primero un diagnóstico del estado actual del sistema y luego implementando los ajustes necesarios para poder exponer el flujo completo a un frontend en React.

El punto de partida fue el repositorio [`hsn656/nestjs-ecommerce`](https://github.com/hsn656/nestjs-ecommerce): un monolito NestJS con una base de diseño clara que modela catálogo de productos, inventario y usuarios. El sistema tenía una estructura modular bien organizada y una serie de decisiones de diseño que reflejaban intención. Sin embargo, se identificaron algunos aspectos que convenía ajustar antes de poder evolucionar el sistema hacia un modelo event-driven y llevar la solución a producción.

El resultado final es un sistema funcional, deployado y accesible, compuesto por:

- **Backend NestJS** con arquitectura event-driven basada en `@nestjs/event-emitter`
- **Frontend Next.js 14** que consume el backend y refleja cambios asincrónicos
- **Base de datos PostgreSQL** gestionada en Neon (serverless)
- **Deploy en Vercel** (backend como serverless function y frontend)

---

## 2. Diagnóstico del repositorio original

Al analizar el repositorio original se identificaron una serie de aspectos técnicos que convenía revisar antes de avanzar hacia una arquitectura event-driven. El diagnóstico buscó entender las decisiones existentes y determinar qué ajustes mínimos permitirían estabilizar la base del proyecto para luego evolucionar sobre ella.

A continuación se describen los aspectos identificados, con su contexto técnico.

---

### 2.1 Imports con path `src/` — portabilidad en compilación

**Observación:** Todos los archivos del proyecto utilizan imports del tipo:

```typescript
import { Product } from 'src/database/entities/product.entity';
import { Auth } from 'src/api/auth/guards/auth.decorator';
```

Estos paths se resuelven correctamente en el entorno de desarrollo gracias a la configuración de `tsconfig.json`, pero en el output compilado el directorio de salida de `tsc` es `dist/`, donde el módulo `src/xxx` no existe. Por eso, el proyecto en su forma compilada requería este ajuste para poder iniciarse fuera del modo `ts-node`.

**Consideración:** Al hacer `npm run start:prod`, el proceso no podía resolver las dependencias. Adaptar los imports a rutas relativas fue el primer paso para habilitar el resto de la evolución.

---

### 2.2 Configuración de CORS

**Observación:** En `main.ts`, el servidor se inicializaba sin configuración de CORS:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(3000);
}
```

Para poder conectar un frontend web desde un origen diferente al del servidor, se necesitaba habilitar CORS explícitamente, ya que los navegadores bloquean por defecto las peticiones cross-origin sin los headers adecuados.

**Consideración:** Sin esta configuración, el sistema no podía ser consumido desde un browser, lo que hacía necesario este ajuste antes de incorporar cualquier frontend.

---

### 2.3 Puerto fijo — adaptación a entornos de deploy

**Observación:** El puerto estaba definido directamente como `3000`, sin lectura de variables de entorno. Las plataformas de deploy como Railway, Render o Vercel asignan el puerto dinámicamente a través de `process.env.PORT`.

**Consideración:** Para que el backend pudiera desplegarse en una plataforma cloud estándar sin modificar el código fuente, se hizo necesario leer el puerto desde el entorno.

---

### 2.4 `deleteProduct` — gestión de dependencias relacionadas

**Observación:** La operación de borrado ejecutaba un `DELETE` directo sobre la entidad `Product`:

```typescript
await this.entityManager
  .createQueryBuilder()
  .delete()
  .from(Product)
  .where('id = :productId', { productId })
  .andWhere('merchantId = :merchantId', { merchantId })
  .execute();
```

Los productos tienen relaciones con `ProductVariation`, `Inventory` y `ProductVariationPrice`. Sin eliminar primero esas entidades dependientes, TypeORM lanza una violación de constraint de FK al intentar borrar un producto con variaciones o stock asociado.

**Consideración:** El endpoint `DELETE /product/:id` no completaba la operación en productos que ya tenían variaciones cargadas. Se agregó la eliminación en cascada de las entidades relacionadas antes de borrar el producto.

---

### 2.5 `activateProduct` — verificación del resultado de la operación

**Observación:** Después de ejecutar el `UPDATE`, la función original retornaba `result.raw[0]` directamente sin verificar si alguna fila fue efectivamente modificada:

```typescript
const result = await this.entityManager...execute();
return result.raw[0]; // puede ser undefined si merchantId no coincide
```

**Consideración:** En el caso en que el producto no perteneciera al merchant que realizaba el request, la operación retornaba sin datos con status 200 en lugar de informar que el recurso no fue encontrado. Se agregó la verificación de `result.affected` para devolver una respuesta consistente en ese escenario.

---

### 2.6 Validación y persistencia en la misma clase

**Observación:** La entidad `Product` combina decoradores de TypeORM con decoradores de `class-validator` en los mismos campos:

```typescript
@Column({ type: 'varchar', nullable: true })
@IsDefined()
@IsString()
public code: string;
```

Esta combinación es una práctica válida en proyectos NestJS más simples, aunque presenta algunas consideraciones cuando el sistema crece:

1. El campo `id` tiene `@IsDefined()` y `@IsNumber()`, lo que puede generar comportamientos inesperados si la validación se invoca sobre una instancia recién creada (antes de persistirse), ya que `id` aún no ha sido asignado.
2. La validación de dominio y el mapeo de base de datos quedan acoplados en el mismo objeto, lo que limita la flexibilidad para evolucionar cada capa de forma independiente.

---

### 2.7 Endpoint de listado de productos

**Observación:** El `ProductController` original solo exponía `GET /product/:id` para consultar un producto por ID. No existía un endpoint para listar productos con paginación.

**Consideración:** Para construir un catálogo navegable desde el frontend, se necesitaba un endpoint que devolviera colecciones de productos con soporte de paginación y filtrado por estado y rol.

---

### 2.8 Flujo sincrónico sin propagación de efectos de dominio

**Observación:** Operaciones con efectos de dominio naturales —como el registro de un usuario o la activación de un producto— completaban su operación principal y retornaban sin propagar ningún evento. `AuthService.register()` creaba el usuario y retornaba; `ProductService.activateProduct()` actualizaba el flag `isActive` y retornaba. No existía mecanismo para reaccionar a esos hechos de forma desacoplada.

**Consideración:** Esta es, en esencia, la evolución que propone el challenge: incorporar un modelo event-driven que permita que otras partes del sistema reaccionen a los hechos de dominio sin generar acoplamiento entre módulos.

---

### 2.9 Módulo de inventario no expuesto

**Observación:** La entidad `Inventory` estaba modelada en la base de datos pero no existía un `InventoryController` ni un `InventoryService` que la expusiera mediante API. El stock de un producto no era consultable desde fuera del sistema.

---

### 2.10 Alcance del rol Administrador en operaciones de producto

**Observación:** En `activateProduct` y `deleteProduct`, la query siempre incluía el filtro por `merchantId`, independientemente del rol del usuario:

```typescript
.andWhere('merchantId = :merchantId', { merchantId })
```

**Consideración:** Con esta lógica, un Administrador quedaba limitado a operar solo sobre sus propios productos, lo que reducía el alcance esperado de ese rol. Se agregó un bypass del filtro de `merchantId` cuando el usuario tiene rol Admin.

---

### 2.11 Configuración de base de datos — soporte para connection string

**Observación:** La configuración de TypeORM aceptaba únicamente variables individuales (`DATABASE_HOST`, `DATABASE_PORT`, etc.), sin soporte para `POSTGRES_URL`. Las bases de datos gestionadas en la nube (Neon, Supabase, Railway) generalmente proveen una connection string única con SSL integrado.

**Consideración:** Para facilitar el deploy con una base de datos cloud, se extendió la configuración para detectar y usar `POSTGRES_URL` cuando está presente, manteniendo las variables individuales para el entorno local con Docker.

---

## 3. Cambios realizados

Los cambios se pensaron para ser **mínimos y justificados**: no un refactor completo del sistema, sino las intervenciones necesarias para que el proyecto pudiera ejecutarse, evolucionar hacia un modelo event-driven y llegar a un entorno de producción. Se buscó respetar las decisiones de diseño originales tanto como fue posible.

---

### 3.1 Imports relativos — portabilidad del build

Todos los imports con path `src/xxx` se reemplazaron por imports relativos (`../../../database/entities/...`). Esto garantiza que el código compilado en `dist/` pueda resolver sus dependencias correctamente, habilitando la ejecución del proyecto en producción.

Este fue el ajuste más importante desde el punto de vista estructural, ya que sin él ninguna mejora posterior podría ejecutarse en un entorno compilado.

---

### 3.2 CORS y configuración de entorno en `main.ts`

```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:3001']
    : ['http://localhost:3001', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
});
await app.listen(process.env.PORT ?? 3000);
```

El backend ahora acepta orígenes configurados vía variable de entorno y delega la asignación del puerto a la plataforma de deploy.

---

### 3.3 Módulo de eventos (`EventsModule`)

Se incorporó `@nestjs/event-emitter` como infraestructura de eventos en proceso. Se creó `EventsModule`, que registra el `EventEmitterModule` con `wildcard: true` para habilitar namespacing de eventos (`product.*`, `user.*`).

```typescript
// src/events/events.module.ts
EventEmitterModule.forRoot({ wildcard: true })
```

Los eventos de dominio se modelan como clases con un `EVENT_NAME` estático, lo que garantiza type-safety tanto en los puntos de emisión como en los listeners:

```typescript
export class ProductActivatedEvent {
  static readonly EVENT_NAME = 'product.activated';
  constructor(
    public readonly productId: number,
    public readonly merchantId: number,
    public readonly categoryId: number,
  ) {}
}
```

---

### 3.4 Módulo de inventario (`InventoryModule`)

Se creó un módulo dedicado que encapsula toda la lógica de stock, separándola del módulo de producto:

- `ProductActivatedListener`: consume el evento `product.activated` y crea los registros de inventario iniciales para las variaciones del producto.
- `InventoryService`: provee consultas de stock por producto.
- `InventoryController`: expone `GET /inventory/product/:id`.

La decisión de aislar el inventario en su propio módulo —en lugar de añadirlo al `ProductModule`— busca respetar la separación de responsabilidades: el módulo de producto determina cuándo un producto es válido para activarse; el módulo de inventario decide qué hacer a partir de ese momento.

---

### 3.5 Módulo de notificaciones (`NotificationModule`)

Se creó un módulo que consume el evento `user.registered` y simula el despacho de un email de bienvenida. La implementación actual registra el evento con logging, con el punto de extensión claramente marcado para integrar un mailer real (`Nodemailer`, `SendGrid`, `SES`, etc.) sin modificar la estructura del sistema.

```typescript
@OnEvent(UserRegisteredEvent.EVENT_NAME, { async: true })
async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
  await this.sendWelcomeEmail(event.email);
}
```

---

### 3.6 `ProductService` — funcionalidad ampliada

Para soportar el flujo completo del challenge y el consumo desde el frontend, se extendió el servicio con las siguientes funcionalidades:

- `listProducts()` con paginación (`page`, `limit`) y filtrado por rol (admins ven todos los productos, merchants ven los propios, customers ven solo los activos).
- `deactivateProduct()` para permitir volver un producto a estado inactivo.
- `createVariation()`, `createVariationInventory()`, `createVariationPrice()` para gestionar el ciclo completo de un producto con variaciones.
- `listColors()`, `listSizes()`, `listCountries()`, `listCurrencies()` para alimentar los formularios del frontend.
- `activateProduct()` ahora emite `ProductActivatedEvent` una vez confirmada la actualización en base de datos.
- `deleteProduct()` ahora elimina en cascada: primero `Inventory`, luego `ProductVariationPrice`, luego `ProductVariation`, y finalmente `Product`.
- Todas las operaciones de admin/merchant incluyen un bypass del filtro de `merchantId` cuando `isAdmin = true`.

---

### 3.7 `AuthService` — emisión de evento en registro

`register()` ahora emite `UserRegisteredEvent` una vez que el usuario es persistido:

```typescript
this.eventEmitter.emit(
  UserRegisteredEvent.EVENT_NAME,
  new UserRegisteredEvent(newUser.id, newUser.email),
);
```

---

### 3.8 Soporte para connection string en la configuración de TypeORM

```typescript
...(process.env.POSTGRES_URL
  ? { url: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false }, extra: { max: 1 } }
  : { host: ..., port: ..., username: ..., password: ..., database: ... }),
```

Esto permite utilizar una base de datos cloud (Neon o similar) en producción, manteniendo el esquema de variables individuales para el entorno local con Docker, sin cambios en el código.

---

### 3.9 Frontend Next.js 14

Se construyó una aplicación nueva que permite validar el flujo completo del sistema de punta a punta. Se detalla en la sección 6.

---

### Qué se conservó sin modificaciones

Se buscó preservar todo lo que el sistema original ya resolvía bien:

- Estructura de módulos (`auth`, `user`, `role`, `product`) y lógica de negocio base.
- Sistema de autenticación JWT con guards y decoradores (`@Auth`, `@CurrentUser`).
- Sistema de roles (Admin, Merchant, Customer).
- Entidades de base de datos.
- Sistema de interceptores (`SerializeInterceptor`, `SucessResponseInterceptor`) y filtro de errores (`ErrorsFilter`).
- Seeders de datos iniciales.
- Migraciones existentes.

---

## 4. Diseño basado en eventos

### 4.1 Justificación del enfoque

En un sistema de e-commerce, ciertas acciones de dominio tienen consecuencias que van más allá del módulo que las origina. Modelar esas consecuencias como llamadas directas entre módulos genera acoplamiento: el módulo emisor necesita conocer a todos sus consumidores.

El enfoque event-driven invierte esta dependencia: el módulo emisor solo anuncia que algo ocurrió; los módulos interesados se suscriben de forma independiente, sin que el emisor necesite saber quiénes son.

---

### 4.2 Evento 1: `product.activated`

**Clase:** `ProductActivatedEvent`
**Emitido en:** `ProductService.activateProduct()`, después de confirmar que la actualización en base de datos fue exitosa.

**Payload:**
```typescript
{
  productId: number,    // ID del producto activado
  merchantId: number,   // ID del merchant propietario
  categoryId: number,   // categoría del producto
}
```

**Por qué este punto:** La activación de un producto representa un momento de dominio bien definido: el producto pasa de borrador a disponible en catálogo. Es el momento natural para inicializar su inventario, ya que antes de esa transición el producto no existía como entidad comercializable.

**Consumidor:** `ProductActivatedListener` (en `InventoryModule`)

**Responsabilidad del consumidor:**
1. Recupera las variaciones del producto recién activado.
2. Si el producto no tiene variaciones (`variationType === 'NONE'`), crea una variación por defecto y un registro de inventario inicial con `quantity: 0`.
3. Si ya tiene variaciones, crea un registro de inventario para cada una que no lo tenga aún.
4. Toda la operación está protegida con un mecanismo de **retry con backoff exponencial** (3 intentos, delay base de 500ms) para aumentar la resiliencia ante fallos transitorios de base de datos.

```typescript
@OnEvent(ProductActivatedEvent.EVENT_NAME, { async: true })
async handleProductActivated(event: ProductActivatedEvent): Promise<void> {
  await this.withRetry(
    () => this.setupInventory(event),
    `inventory-setup:product-${event.productId}`,
  );
}
```

El flag `{ async: true }` en `@OnEvent` garantiza que el listener se ejecuta de forma asincrónica y no bloquea el response HTTP del endpoint de activación.

---

### 4.3 Evento 2: `user.registered`

**Clase:** `UserRegisteredEvent`
**Emitido en:** `AuthService.register()`, después de persistir el usuario.

**Payload:**
```typescript
{
  userId: number,   // ID del nuevo usuario
  email: string,    // email de registro
}
```

**Por qué este punto:** El registro es un momento de ciclo de vida del usuario. Las acciones de bienvenida (email, onboarding) son side-effects que pertenecen a módulos distintos al de autenticación, y modelarlos como eventos permite que `AuthService` no necesite conocer su existencia.

**Consumidor:** `UserRegisteredListener` (en `NotificationModule`)

**Responsabilidad del consumidor:** Despacha un email de bienvenida. La implementación actual simula el envío con logging, con el punto de extensión claramente identificado para integrar con `Nodemailer`, `SendGrid`, `SES`, etc., sin modificar la estructura del sistema.

---

### 4.4 Cómo se desacoplaron los módulos

| Sin eventos (acoplado) | Con eventos (desacoplado) |
|---|---|
| `ProductService` llamaría directamente a `InventoryService` | `ProductService` emite `product.activated`; `InventoryModule` suscribe de forma independiente |
| `AuthService` llamaría directamente a un `EmailService` | `AuthService` emite `user.registered`; `NotificationModule` suscribe de forma independiente |
| Agregar un nuevo consumidor requiere modificar el emisor | Agregar un nuevo consumidor solo requiere crear un nuevo listener |

**Flujo técnico:**

```
ProductService.activateProduct()
  └─ eventEmitter.emit('product.activated', event)
        └─ [async] ProductActivatedListener.handleProductActivated(event)
              └─ withRetry(() => setupInventory(event))
                    └─ Inventory records created in DB
```

---

### 4.5 Beneficios concretos del enfoque event-driven en este sistema

1. **`ProductModule` no importa `InventoryModule`**: se elimina una potencial dependencia circular entre módulos.
2. **Side-effects extensibles**: agregar analytics, notificaciones push o sincronización con un sistema de warehouse solo requiere crear un nuevo listener, sin tocar el código existente.
3. **El response HTTP no espera los side-effects**: el endpoint de activación responde inmediatamente; el inventario se inicializa en background.
4. **Resiliencia**: el mecanismo de retry en `ProductActivatedListener` evita que un fallo transitorio de base de datos descarte silenciosamente la operación.

---

## 5. Arquitectura del sistema

### 5.1 Diagrama de capas

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 14)                     │
│  /login  /register  /dashboard  /dashboard/inventory        │
│  AuthContext · ProductsContext · API Client (fetch)         │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS · REST · Bearer JWT
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   BACKEND (NestJS)                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   Auth   │  │  Product │  │   User   │  │   Role    │  │
│  │ Module   │  │  Module  │  │  Module  │  │  Module   │  │
│  └────┬─────┘  └────┬─────┘  └──────────┘  └───────────┘  │
│       │              │                                      │
│       │ emit         │ emit                                 │
│       ▼              ▼                                      │
│  ┌────────────────────────────────────────┐                 │
│  │         EventEmitter2 (in-process)     │                 │
│  └──────────┬─────────────────┬───────────┘                 │
│             │                 │                             │
│             ▼                 ▼                             │
│  ┌──────────────────┐  ┌──────────────────────┐            │
│  │ NotificationModule│  │   InventoryModule    │            │
│  │ UserRegistered    │  │ ProductActivated     │            │
│  │ Listener         │  │ Listener + Service   │            │
│  └──────────────────┘  └──────────────────────┘            │
│                                                             │
│  ┌─────────────────────────────────────────┐               │
│  │            TypeORM + PostgreSQL          │               │
│  └─────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│              BASE DE DATOS (PostgreSQL / Neon)              │
│  users · roles · products · product_variations             │
│  inventory · product_variation_prices · categories         │
│  colors · sizes · countries · currencies                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 5.2 Módulos del backend

| Módulo | Responsabilidad |
|---|---|
| `AppModule` | Raíz. Registra Config, TypeORM, EventEmitter y todos los módulos. |
| `ApiModule` | Agrupa los módulos REST: Auth, User, Role, Product. Registra interceptores y filtros globales. |
| `AuthModule` | Login, registro, generación de JWT. Emite `user.registered`. |
| `UserModule` | CRUD de usuarios, hash de passwords, perfil. |
| `RoleModule` | Gestión de roles, asignación a usuarios. |
| `ProductModule` | Ciclo completo de producto: crear, detallar, activar, desactivar, eliminar, listar. Emite `product.activated`. |
| `EventsModule` | Registra `EventEmitterModule`. Contiene las clases de eventos de dominio. |
| `InventoryModule` | Listener de `product.activated`, servicio y controller de inventario. |
| `NotificationModule` | Listener de `user.registered`, simulación de envío de email de bienvenida. |

---

### 5.3 Flujo completo: Usuario → Backend → Evento → Consumidor → Frontend

**Caso 1: Activación de producto**

```
1. Merchant hace POST /product/:id/activate (con JWT)
2. ProductController extrae user.roles para determinar isAdmin
3. ProductService.activateProduct():
   a. Valida que el producto está completo (class-validator sobre entidad)
   b. Ejecuta UPDATE products SET isActive=true
   c. Verifica affected > 0
   d. Emite ProductActivatedEvent { productId, merchantId, categoryId }
   e. Retorna { id, isActive: true }
4. HTTP response 200 enviado inmediatamente
5. [ASYNC] ProductActivatedListener.handleProductActivated():
   a. Busca variaciones del producto en DB
   b. Para cada variación sin inventario: INSERT INTO inventory (quantity=0)
   c. Si NONE y sin variaciones: crea variación por defecto + inventory
6. Frontend recibe { isActive: true }
7. Frontend actualiza estado local del producto sin re-fetch completo
8. Frontend llama GET /inventory/product/:id para mostrar el stock actualizado
9. Dashboard se actualiza vía ProductsContext.triggerRefresh()
```

**Caso 2: Registro de usuario**

```
1. Usuario hace POST /auth/register { email, password }
2. AuthService.register():
   a. Verifica que el email no existe
   b. Crea usuario con password hasheado (bcrypt)
   c. Asigna rol Customer
   d. Emite UserRegisteredEvent { userId, email }
   e. Retorna { message: 'success' }
3. HTTP response 200 enviado inmediatamente
4. [ASYNC] UserRegisteredListener.handleUserRegistered():
   a. Llama sendWelcomeEmail(email)
   b. Registra el despacho en log (punto de extensión para mailer real)
5. Frontend redirige a login
```

---

### 5.4 Endpoints del backend

**Auth**
```
POST /auth/login        → { accessToken }
POST /auth/register     → { message: 'success' }
```

**User**
```
GET  /user/profile      [auth] → UserDto { id, email }
```

**Product**
```
GET  /product                           [auth]           → PaginatedProducts
GET  /product/colors                    [auth]           → Color[]
GET  /product/sizes                     [auth]           → Size[]
GET  /product/countries                 [auth]           → Country[]
GET  /product/currencies                [auth]           → Currency[]
GET  /product/:id                                        → Product
POST /product/create                    [admin|merchant] → Product
POST /product/:id/details               [admin|merchant] → { id }
POST /product/:id/activate              [admin|merchant] → { id, isActive }
POST /product/:id/deactivate            [admin|merchant] → { id, isActive }
POST /product/:id/variations            [admin|merchant] → { id }
POST /product/:id/variations/:vId/inventory [admin|merchant] → { id }
POST /product/:id/variations/:vId/prices    [admin|merchant] → { id }
DELETE /product/:id                     [admin|merchant] → successObject
```

**Inventory**
```
GET  /inventory/product/:id [auth] → Inventory[]
```

---

## 6. Frontend

### 6.1 Stack y estructura

El frontend fue construido con **Next.js 14 (App Router)** y **Tailwind CSS**. Dado que el challenge evalúa arquitectura y funcionalidad —no diseño visual—, la interfaz es funcional y limpia, orientada a demostrar el flujo completo del sistema.

```
src/
├── app/
│   ├── page.tsx                    # Landing: redirige según auth
│   ├── login/page.tsx              # Formulario de login
│   ├── register/page.tsx           # Formulario de registro
│   ├── layout.tsx                  # Root layout con AuthProvider
│   └── dashboard/
│       ├── layout.tsx              # Sidebar + nav con roles
│       ├── page.tsx                # Catálogo de productos activos
│       └── inventory/page.tsx      # Gestión de inventario (wizard)
└── lib/
    ├── api/
    │   ├── client.ts               # Fetch wrapper con JWT desde localStorage
    │   ├── auth.ts                 # login(), register(), getProfile()
    │   ├── products.ts             # CRUD completo de productos
    │   └── inventory.ts            # getProductInventory()
    └── context/
        ├── AuthContext.tsx          # Estado de autenticación global
        └── ProductsContext.tsx      # refreshKey para sincronización entre páginas
```

---

### 6.2 Consumo del backend

El cliente HTTP central (`src/lib/api/client.ts`) es un wrapper sobre `fetch` nativo que:

1. Lee el JWT desde `localStorage`.
2. Lo inyecta como `Authorization: Bearer <token>` en cada request.
3. Mapea respuestas no-OK a `Error` con el mensaje del backend.
4. Usa `cache: 'no-store'` para evitar respuestas cacheadas en el cliente.

```typescript
const token = localStorage.getItem('token');
const headers = { 'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}) };
```

---

### 6.3 Manejo de estado asincrónico

El frontend refleja cambios derivados de operaciones asincrónicas de dos formas:

**A) Actualización local de estado sin re-fetch completo**

Cuando se activa o desactiva un producto, el frontend actualiza únicamente el item afectado en el estado local de React y luego dispara una consulta de inventario para ese producto específico:

```typescript
setProducts(prev =>
  prev.map(p => p.id === result.id ? { ...p, isActive: result.isActive } : p)
);
// Consulta asincrónica del stock actualizado (consecuencia del evento server-side)
getProductInventory(product.id).then(records => {
  const qty = records.reduce((s, r) => s + r.quantity, 0);
  setStockMap(prev => new Map(prev).set(product.id, qty));
});
```

Esto refleja en la UI el resultado del evento `product.activated`: el listener crea los registros de inventario en background, y el frontend los consulta inmediatamente después de recibir la confirmación de activación.

**B) `ProductsContext` como mecanismo de sincronización entre vistas**

El contexto `ProductsContext` expone un `refreshKey` (número que se incrementa) y un `triggerRefresh()`. El dashboard del catálogo escucha `refreshKey` en un `useEffect` y re-fetcha la lista cuando este cambia. La página de inventario llama `triggerRefresh()` después de cada operación relevante (activar, desactivar, crear, eliminar).

```typescript
// Dashboard: se re-renderiza cuando refreshKey cambia
useEffect(() => { fetchNextPage(); }, [refreshKey, fetchNextPage]);

// Inventario: dispara el refresh después de cada operación
triggerRefresh();
```

---

### 6.4 Flujo de punta a punta validable

El flujo completo que permite verificar el sistema funcionando end-to-end:

1. **Registrarse** en `/register` → el backend crea el usuario y despacha el evento `user.registered` (visible en el log del servidor).
2. **Login** en `/login` con la cuenta creada → JWT almacenado en `localStorage`.
3. Como **Admin o Merchant**: ir a `/dashboard/inventory`.
4. Crear un producto con el **wizard de 4 pasos**: categoría → detalles + variaciones → activar → confirmación.
5. Al activar, el backend emite `product.activated` → el listener inicializa el inventario en background.
6. La columna **Stock** en la tabla se actualiza mostrando el inventario creado por el listener.
7. El **catálogo** (`/dashboard`) se actualiza vía `refreshKey`, mostrando el nuevo producto activo.

---

### 6.5 Control de acceso en el frontend

El `AuthContext` realiza una llamada a `GET /user/profile` para obtener los roles del usuario autenticado. El dashboard layout muestra u oculta la sección de Inventario según si el usuario tiene rol Admin o Merchant.

```typescript
const isAdmin = profile?.roles?.some(r => r.id === ROLE_IDS.ADMIN) ?? false;
const isMerchant = profile?.roles?.some(r => r.id === ROLE_IDS.MERCHANT) ?? false;
```

---

## 7. Deploy

### 7.1 Infraestructura utilizada

| Componente | Plataforma | Notas |
|---|---|---|
| Backend | Vercel (Serverless) | Build con `tsconfig.vercel.json`, output `dist-vercel/` |
| Frontend | Vercel | Next.js App Router |
| Base de datos | Neon (PostgreSQL serverless) | Conexión vía `POSTGRES_URL` con SSL |

### 7.2 Variables de entorno

**Backend (Vercel)**

```env
# Base de datos (Neon)
POSTGRES_URL=postgresql://user:password@host/db?sslmode=require

# JWT
JWT_SECRET=<secret>
JWT_EXPIRATION=3h

# Admin por defecto (para seed)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<password>

# CORS
FRONTEND_URL=https://nestjs-ecommerce-front.vercel.app/
```

**Frontend (Vercel)**

```env
NEXT_PUBLIC_API_URL=https://nestjs-ecommerce-back.vercel.app/
```

---

## 8. Cómo ejecutar el proyecto

### 8.1 Requisitos

- Node.js 18+
- Docker (para PostgreSQL local)
- npm

---

### 8.2 Backend local

```bash
cd back

# 1. Instalar dependencias
npm install

# 2. Levantar PostgreSQL con Docker
docker-compose up -d

# 3. Crear archivo de variables de entorno
# En back/src/common/envs/.env.development:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=hassan
DATABASE_PASSWORD=password
DATABASE_NAME=postgres
JWT_SECRET=local-secret
JWT_EXPIRATION=3h
ADMIN_EMAIL=admin@admin.com
ADMIN_PASSWORD=12345678

# 4. Ejecutar migraciones
npm run migration:run:local

# 5. Cargar datos semilla (roles, admin, categorías, colores, tallas, países, monedas)
npm run seed:run:local

# 6. Iniciar el servidor
npm run start:dev
# → API disponible en http://localhost:3000
```

---

### 8.3 Frontend local

```bash
cd front

# 1. Instalar dependencias
npm install

# 2. Crear archivo de variables de entorno
# front/.env.local:
NEXT_PUBLIC_API_URL=http://localhost:3000

# 3. Iniciar el servidor de desarrollo
npm run dev
# → App disponible en http://localhost:3001
```

---

### 8.4 Cuenta de prueba

Después de ejecutar el seed, el sistema tiene un usuario administrador disponible:

```
Email:    admin@admin.com
Password: 12345678
```

---

## 9. Conclusión técnica

El repositorio original tenía una estructura modular bien pensada y un modelo de datos que reflejaba el dominio con claridad. El trabajo realizado partió de ese diseño y se concentró en hacer ajustes que lo estabilizaran y habilitaran su evolución: primero resolver lo que impedía la ejecución en producción, luego corregir algunos comportamientos que podían resultar inconsistentes, y finalmente incorporar la capa event-driven que el challenge proponía.

La secuencia de decisiones siguió una lógica clara:

1. **Estabilización**: imports portables, CORS, puerto configurable desde entorno.
2. **Correcciones de comportamiento**: cascade en delete, verificación de filas afectadas, bypass del rol Admin.
3. **Evolución del diseño**: bus de eventos en proceso, módulos desacoplados, frontend que cierra el ciclo de extremo a extremo.

La elección de `@nestjs/event-emitter` por sobre un message broker externo (Kafka, RabbitMQ) fue deliberada para el alcance del challenge: es la herramienta adecuada para eventos in-process en un monolito NestJS, sin agregar infraestructura que complejice el setup local o el deploy. Si el sistema evolucionara hacia microservicios, el patrón de eventos de dominio implementado —con clases tipadas y listeners desacoplados— permitiría reemplazar el transporte de forma transparente para los módulos emisores y consumidores.

El resultado es un sistema funcional y deployado que busca mostrar comprensión del **dominio** (cuándo tiene sentido emitir un evento), de la **arquitectura** (cómo separar responsabilidades de forma sostenible) y de la **operabilidad** (cómo llevar el sistema a un entorno real con configuración adecuada).
