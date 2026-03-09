# Urbano Ecommerce — Solución Event-Driven

Challenge de evolución arquitectónica sobre una base NestJS + PostgreSQL, incorporando diseño orientado a eventos y un frontend React para validar el sistema de punta a punta.

---

## Tabla de contenidos

1. [Problemas detectados en el diseño original](#1-problemas-detectados-en-el-diseño-original)
2. [Eventos implementados y justificación](#2-eventos-implementados-y-justificación)
3. [Decisiones técnicas relevantes](#3-decisiones-técnicas-relevantes)
4. [Cómo levantar el proyecto](#4-cómo-levantar-el-proyecto)

---

## 1. Problemas detectados en el diseño original

### Sin catálogo listable

El módulo de producto exponía únicamente `GET /product/:id`. No existía un endpoint para listar productos, lo que impedía construir cualquier vista de catálogo o panel de administración. El `ProductService` tampoco diferenciaba entre roles: un admin, un merchant y un customer deberían ver subconjuntos distintos de productos.

### Sin endpoint de desactivación

El ciclo de vida de un producto solo contemplaba activación (`POST /product/:id/activate`) y eliminación (`DELETE /product/:id`). No había forma de desactivar un producto ya publicado sin borrarlo, lo que fuerza destructividad innecesaria.

### Sin arquitectura orientada a eventos

Todo el sistema operaba de forma sincrónica y con acoplamiento directo entre módulos. No existía ningún mecanismo de emisión ni suscripción de eventos. Consecuencias concretas:

- `ProductService` habría necesitado importar directamente `InventoryService`, `NotificationService`, etc., creando dependencias cruzadas difíciles de mantener.
- Agregar cualquier efecto secundario a una operación (activar un producto, registrar un usuario) requería modificar el servicio de dominio.

### Sin integración frontend

El repositorio original no incluía interfaz de usuario ni configuración CORS. Era imposible validar el sistema de punta a punta sin construir el cliente por separado o usar herramientas externas.

### Sin modelo de inventario activo

La entidad `Inventory` existía en el esquema pero nunca se escribía desde el código. Era una tabla vacía sin lógica de negocio asociada.

---

## 2. Eventos implementados y justificación

Los eventos se definen como clases tipadas en `back/src/events/domain/`, con un `EVENT_NAME` estático para evitar strings mágicos dispersos en el código.

### `user.registered`

**Dónde se emite:** `AuthService.register()`, inmediatamente después de persistir el usuario y asignarle el rol.

**Quién lo escucha:** `UserRegisteredListener` en `NotificationModule`.

**Qué hace el listener:** Loggea el evento y simula el envío de un email de bienvenida (punto de extensión listo para conectar Nodemailer, SendGrid, etc.).

**Por qué este punto:** El registro de un usuario es un hecho de dominio relevante que puede tener múltiples consecuencias: notificación, onboarding, auditoría. Emitir el evento permite que `AuthModule` no sepa nada de `NotificationModule`. Si mañana se agrega un sistema de créditos de bienvenida, se añade un nuevo listener sin tocar `AuthService`.

---

### `product.activated`

**Dónde se emite:** `ProductService.activateProduct()`, después de confirmar que el UPDATE afectó filas en la base de datos (guard contra race conditions).

**Quién lo escucha:** `ProductActivatedListener` en `InventoryModule`.

**Qué hace el listener:**
1. Consulta las `ProductVariation` asociadas al producto.
2. Si el producto tiene `variationType = 'NONE'` y no tiene variaciones, crea una `ProductVariation` default (`sizeCode=NA`, `colorName=NA`) para poder registrar stock.
3. Crea un registro `Inventory` con `quantity=0` y `countryCode=EG` para cada variación (o solo para la variación default).
4. Si la variación ya tiene registro de inventario, loggea el stock actual sin duplicar.
5. Todo el proceso está envuelto en un mecanismo de reintentos con backoff lineal (`withRetry`, 3 intentos, 500/1000/1500 ms) para garantizar consistencia eventual ante fallos transitorios de base de datos.

**Por qué este punto:** La activación de un producto es el momento natural para inicializar su inventario. `ProductService` no sabe que existe un `InventoryModule` — solo emite el evento. Esto permite que el sistema de inventario evolucione de forma completamente independiente.

---

### Flujo completo de eventos

```
[AuthService]
  register()
    → emite user.registered
        → [UserRegisteredListener] sendWelcomeEmail()

[ProductService]
  activateProduct()
    → UPDATE product SET isActive = true
    → emite product.activated
        → [ProductActivatedListener]
              create ProductVariation (default si variationType=NONE)
              create Inventory { quantity: 0, countryCode: EG }
              (con retry x3 + backoff lineal)
```

---

## 3. Decisiones técnicas relevantes

### EventEmitter2 en lugar de una cola de mensajes externa

Se usó `@nestjs/event-emitter` (wrapper de EventEmitter2) porque el objetivo del challenge es demostrar el patrón event-driven dentro del proceso NestJS, sin agregar infraestructura externa (Redis, RabbitMQ, Kafka). Es un trade-off explícito: el sistema es suficiente para el alcance del ejercicio. En producción con múltiples instancias, se reemplazaría por un broker real.

### `async: true` en todos los listeners

Los listeners se registran con `{ async: true }` en `@OnEvent`. Esto garantiza que el handler no bloquea el hilo del event loop del servicio que emitió el evento. La respuesta HTTP del endpoint (`activate`, `register`) llega al cliente antes de que el listener complete su trabajo — esto es asincronía real, no simulada.

### EntityManager en lugar de Repository

Tanto `ProductActivatedListener` como `InventoryService` usan `EntityManager` inyectado directamente, en vez de repositorios específicos por entidad. Esto simplifica el módulo (no necesita `TypeOrmModule.forFeature([...])`), y el `EntityManager` global ya está provisto por `TypeOrmModule.forRootAsync`.

### Guard de race condition en `activateProduct`

El evento `product.activated` se emite **después** de verificar que `result.affected >= 1`. Si el UPDATE no afectó ninguna fila (producto inexistente o merchantId incorrecto), se lanza `NotFoundException` y el evento nunca se emite. Esto evita crear registros de inventario huérfanos por operaciones que en realidad fallaron.

### Delete en cascada manual en `deleteProduct`

Las entidades `ProductVariation` e `Inventory` no tienen `onDelete: 'CASCADE'` configurado en TypeORM. Cuando el listener crea registros hijos al activar un producto, la eliminación directa del `Product` viola FK constraints de PostgreSQL. La solución fue hacer el delete ordenado en `ProductService.deleteProduct`: primero verificar ownership, luego eliminar `Inventory` → `ProductVariation` → `Product`. Este orden respeta las dependencias del esquema sin necesitar una migración.

### JwtModule con `global: true`

`JwtModule.register({ global: true, ... })` en `AuthModule` hace que `JwtService` esté disponible en todos los módulos sin necesidad de importarlo individualmente. Para que `AuthGuard` funcione en `InventoryModule`, solo fue necesario importar `UserModule` (que exporta `UserService`).

### Stock asincrónico en el frontend

La columna "Stock" en la página de Inventario no bloquea el render de la tabla. Cuando se cargan los productos, se dispara un `Promise.all` paralelo de llamadas a `GET /inventory/product/:id` para todos los productos de la página. Mientras llegan las respuestas, cada celda muestra un spinner. Esto hace visible en la UI el comportamiento asincrónico del sistema: el inventario es un efecto secundario del evento, no parte de la respuesta principal.

### Separación de módulos

```
AppModule
├── EventsModule      ← configura EventEmitter2 (global)
├── InventoryModule   ← escucha product.activated, expone GET /inventory
├── NotificationModule ← escucha user.registered
└── ApiModule
    ├── AuthModule    ← emite user.registered
    ├── ProductModule ← emite product.activated
    ├── UserModule
    └── RoleModule
```

`ProductModule` y `NotificationModule` no se importan entre sí en ningún momento. El único canal de comunicación entre ellos es el bus de eventos.

---

## 4. Cómo levantar el proyecto

### Opción A — Docker Compose (recomendada)

Levanta Postgres, backend y frontend en un solo comando.

**Requisitos:** Docker Desktop instalado y corriendo.

```bash
# Desde la raíz del proyecto
docker compose up --build
```

| Servicio  | URL                    |
|-----------|------------------------|
| Frontend  | http://localhost:3001  |
| Backend   | http://localhost:3000  |
| Postgres  | localhost:5432         |

El backend corre migraciones y seeders automáticamente al iniciar en modo producción.

**Credenciales de acceso por defecto:**

| Campo    | Valor              |
|----------|--------------------|
| Email    | admin@admin.com    |
| Password | 12345678           |
| Rol      | Admin              |

---

### Opción B — Desarrollo local (backend + frontend por separado)

#### Prerequisitos

- Node.js 18+
- PostgreSQL 15 corriendo localmente (o via Docker)

#### 1. Base de datos

```bash
# Solo Postgres, sin backend ni frontend
docker compose up postgres -d
```

#### 2. Backend

```bash
cd back
npm install

# Ejecutar migraciones
npm run migration:run

# Cargar datos iniciales (roles, admin, categorías, colores, tallas, países)
npm run seed:run

# Iniciar en modo desarrollo (hot reload)
npm run start:dev
```

El backend escucha en `http://localhost:3000`.

Variables de entorno relevantes (`back/src/common/envs/development.env`):

| Variable           | Valor por defecto       |
|--------------------|-------------------------|
| `PORT`             | 3000                    |
| `DATABASE_HOST`    | localhost               |
| `DATABASE_PORT`    | 5432                    |
| `DATABASE_NAME`    | ecommercedb             |
| `DATABASE_USER`    | hassan                  |
| `DATABASE_PASSWORD`| password                |
| `JWT_SECRET`       | secret                  |
| `ADMIN_EMAIL`      | admin@admin.com         |
| `ADMIN_PASSWORD`   | 12345678                |

#### 3. Frontend

```bash
cd front
npm install
npm run dev
```

El frontend escucha en `http://localhost:3001`.

Variable de entorno relevante:

| Variable               | Valor por defecto       |
|------------------------|-------------------------|
| `NEXT_PUBLIC_API_URL`  | http://localhost:3000   |

---

### Documentación de la API (Postman)

La colección de Postman con todos los endpoints, ejemplos de request y variables de entorno se encuentra en:

```
back/documentation/Nestjs Ecommerce.postman_collection.json
```

Para usarla: importá el archivo en Postman, ejecutá `POST /auth/login` con las credenciales del admin, y copiá el `accessToken` de la respuesta como valor de la variable `token` de la colección.

> Para probar endpoints protegidos agregá el header `Authorization: Bearer <token>` en cada request, o configuralo como variable a nivel de colección.

---

### Tests

```bash
cd back

# Tests unitarios
npm run test

# Tests end-to-end
npm run test:e2e
```
