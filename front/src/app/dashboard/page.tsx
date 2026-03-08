'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  createProduct,
  addProductDetails,
  activateProduct,
  getProduct,
  Product,
} from '@/lib/api/products';

/* ───────────── Types ───────────── */
interface EventEntry {
  id: number;
  name: string;
  payload: Record<string, unknown>;
  listener?: string;
  timestamp: string;
}

type WizardStep = 1 | 2 | 3 | 4;

/* ───────────── Component ───────────── */
export default function DashboardPage() {
  const { user } = useAuth();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 fields
  const [categoryId, setCategoryId] = useState('1');

  // Step 2 fields
  const [title, setTitle] = useState('Laptop Demo');
  const [code, setCode] = useState(`LAPTOP-${Date.now().toString().slice(-4)}`);
  const [brand, setBrand] = useState('Dell');
  const [series, setSeries] = useState('XPS');
  const [capacity, setCapacity] = useState('512');
  const [capacityUnit, setCapacityUnit] = useState<'GB' | 'TB'>('GB');
  const [capacityType, setCapacityType] = useState<'SSD' | 'HD'>('SSD');
  const [description, setDescription] = useState('Laptop de alta performance para trabajo y gaming.');
  const [about, setAbout] = useState('Alta performance\nPantalla Full HD\nBatería de larga duración');

  // Event log
  const [events, setEvents] = useState<EventEntry[]>([]);

  const addEvent = (name: string, payload: Record<string, unknown>, listener?: string) => {
    setEvents((prev) => [
      {
        id: Date.now(),
        name,
        payload,
        listener,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
  };

  /* ─── Step 1: Create Product ─── */
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const created = await createProduct({ categoryId: parseInt(categoryId) });
      setProduct(created);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el producto');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Step 2: Add Details ─── */
  const handleAddDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError('');
    setLoading(true);
    try {
      await addProductDetails(product.id, {
        title,
        code,
        variationType: 'NONE',
        details: {
          category: 'Computers',
          capacity: parseInt(capacity),
          capacityUnit,
          capacityType,
          brand,
          series,
        },
        about: about.split('\n').filter((l) => l.trim()),
        description,
      });
      // Refresh product
      const refreshed = await getProduct(product.id);
      setProduct(refreshed);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al agregar detalles');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Step 3: Activate ─── */
  const handleActivate = async () => {
    if (!product) return;
    setError('');
    setLoading(true);
    try {
      const result = await activateProduct(product.id);
      setProduct((prev) => prev ? { ...prev, isActive: result.isActive } : prev);

      // Show fired events
      addEvent(
        'ProductActivatedEvent',
        { productId: product.id, merchantId: product.merchantId, categoryId: product.categoryId },
      );
      addEvent(
        'InventoryListener',
        { message: `Inventory initialization ready for product ${product.id}` },
        'ProductActivatedListener',
      );

      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al activar el producto');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Reset ─── */
  const handleReset = () => {
    setStep(1);
    setProduct(null);
    setError('');
    setCode(`LAPTOP-${Date.now().toString().slice(-4)}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Bienvenido, <span className="text-[#c1292e]">{user?.email}</span>
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Demo del flujo event-driven: registro → producto → activación → inventario
        </p>
      </div>

      {/* Architecture overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 text-sm overflow-x-auto">
        <ArchBadge label="POST /auth/register" color="blue" note="→ UserRegisteredEvent" />
        <Arrow />
        <ArchBadge label="POST /product/create" color="gray" note="→ crea producto" />
        <Arrow />
        <ArchBadge label="POST /product/:id/activate" color="red" note="→ ProductActivatedEvent" />
        <Arrow />
        <ArchBadge label="InventoryListener" color="green" note="→ inicializa stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Wizard (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Step content */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            {error && (
              <div className="mb-4 text-sm text-[#c1292e] bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {step === 1 && (
              <Step1
                categoryId={categoryId}
                setCategoryId={setCategoryId}
                onSubmit={handleCreateProduct}
                loading={loading}
              />
            )}
            {step === 2 && (
              <Step2
                productId={product?.id}
                title={title} setTitle={setTitle}
                code={code} setCode={setCode}
                brand={brand} setBrand={setBrand}
                series={series} setSeries={setSeries}
                capacity={capacity} setCapacity={setCapacity}
                capacityUnit={capacityUnit} setCapacityUnit={setCapacityUnit}
                capacityType={capacityType} setCapacityType={setCapacityType}
                description={description} setDescription={setDescription}
                about={about} setAbout={setAbout}
                onSubmit={handleAddDetails}
                loading={loading}
              />
            )}
            {step === 3 && (
              <Step3
                product={product}
                onActivate={handleActivate}
                loading={loading}
              />
            )}
            {step === 4 && (
              <Step4 product={product} onReset={handleReset} />
            )}
          </div>
        </div>

        {/* Event log (1/3) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col h-fit">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-[#c1292e] rounded-full animate-pulse" />
            <h3 className="text-sm font-semibold text-gray-800">Event Log</h3>
          </div>

          {events.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              Los eventos aparecerán aquí al activar un producto
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((ev) => (
                <div key={ev.id} className="border border-gray-100 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold ${ev.listener ? 'text-green-700' : 'text-orange-600'}`}>
                      {ev.listener ? `📥 ${ev.listener}` : `⚡ ${ev.name}`}
                    </span>
                    <span className="text-gray-400">{ev.timestamp}</span>
                  </div>
                  {ev.listener && (
                    <p className="text-gray-500 mb-1">handles: {ev.name}</p>
                  )}
                  <pre className="bg-gray-50 rounded p-2 text-gray-700 overflow-x-auto">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {events.length > 0 && (
            <p className="mt-4 text-xs text-gray-400 text-center">
              Verificá los logs del backend para confirmar la ejecución del listener
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────
   Sub-components
─────────────────────────────────────── */

function StepIndicator({ current }: { current: WizardStep }) {
  const steps = [
    { n: 1, label: 'Crear Producto' },
    { n: 2, label: 'Agregar Detalles' },
    { n: 3, label: 'Activar' },
    { n: 4, label: 'Resultado' },
  ];

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s.n < current
                  ? 'bg-green-500 text-white'
                  : s.n === current
                  ? 'bg-[#c1292e] text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {s.n < current ? '✓' : s.n}
            </div>
            <span className={`text-xs ${s.n === current ? 'text-[#c1292e] font-medium' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mb-4 ${s.n < current ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function Step1({
  categoryId,
  setCategoryId,
  onSubmit,
  loading,
}: {
  categoryId: string;
  setCategoryId: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Paso 1 — Crear Producto</h2>
        <p className="text-sm text-gray-500">
          Crea un producto nuevo. Se vinculará con tu usuario como merchant.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]"
        >
          <option value="1">Computadoras (ID: 1)</option>
          <option value="2">Moda (ID: 2)</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Creando...' : 'Crear Producto →'}
      </button>
    </form>
  );
}

function Step2({
  productId,
  title, setTitle,
  code, setCode,
  brand, setBrand,
  series, setSeries,
  capacity, setCapacity,
  capacityUnit, setCapacityUnit,
  capacityType, setCapacityType,
  description, setDescription,
  about, setAbout,
  onSubmit,
  loading,
}: {
  productId?: number;
  title: string; setTitle: (v: string) => void;
  code: string; setCode: (v: string) => void;
  brand: string; setBrand: (v: string) => void;
  series: string; setSeries: (v: string) => void;
  capacity: string; setCapacity: (v: string) => void;
  capacityUnit: 'GB' | 'TB'; setCapacityUnit: (v: 'GB' | 'TB') => void;
  capacityType: 'SSD' | 'HD'; setCapacityType: (v: 'SSD' | 'HD') => void;
  description: string; setDescription: (v: string) => void;
  about: string; setAbout: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">
          Paso 2 — Detalles del Producto{' '}
          <span className="text-sm font-normal text-gray-400">(ID: {productId})</span>
        </h2>
        <p className="text-sm text-gray-500">
          Completá los campos para que el producto esté listo para activarse.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Título" value={title} onChange={setTitle} required />
        <FormField label="Código" value={code} onChange={setCode} required />
        <FormField label="Marca" value={brand} onChange={setBrand} required />
        <FormField label="Serie" value={series} onChange={setSeries} required />
        <FormField label="Capacidad" value={capacity} onChange={setCapacity} type="number" required />
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Unidad</label>
          <select
            value={capacityUnit}
            onChange={(e) => setCapacityUnit(e.target.value as 'GB' | 'TB')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]"
          >
            <option>GB</option>
            <option>TB</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de almacenamiento</label>
          <select
            value={capacityType}
            onChange={(e) => setCapacityType(e.target.value as 'SSD' | 'HD')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]"
          >
            <option>SSD</option>
            <option>HD</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e] resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Características (una por línea)
        </label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e] resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Guardando...' : 'Guardar Detalles →'}
      </button>
    </form>
  );
}

function Step3({
  product,
  onActivate,
  loading,
}: {
  product: Product | null;
  onActivate: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Paso 3 — Activar Producto</h2>
        <p className="text-sm text-gray-500">
          Al activar se dispara el <code className="bg-gray-100 px-1 rounded text-xs">ProductActivatedEvent</code> que el <code className="bg-gray-100 px-1 rounded text-xs">InventoryListener</code> consume de forma desacoplada.
        </p>
      </div>

      {product && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">ID:</span>
            <span className="font-mono font-medium">{product.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Título:</span>
            <span className="font-medium">{product.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Código:</span>
            <span className="font-mono">{product.code}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estado:</span>
            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">
              Inactivo
            </span>
          </div>
        </div>
      )}

      <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 text-sm">
        <p className="font-medium text-orange-800 mb-1">¿Qué ocurre al activar?</p>
        <ol className="list-decimal list-inside text-orange-700 space-y-1 text-xs">
          <li>ProductService actualiza <code>isActive = true</code> en la DB</li>
          <li>Se emite <code>ProductActivatedEvent</code> vía EventEmitter2</li>
          <li>ProductActivatedListener lo recibe de forma <strong>asíncrona y desacoplada</strong></li>
          <li>El listener inicializa el inventario (extensión sin tocar ProductService)</li>
        </ol>
      </div>

      <button
        onClick={onActivate}
        disabled={loading}
        className="w-full bg-[#c1292e] hover:bg-red-700 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Activando...
          </>
        ) : (
          '⚡ Activar Producto'
        )}
      </button>
    </div>
  );
}

function Step4({
  product,
  onReset,
}: {
  product: Product | null;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Paso 4 — Resultado</h2>
      </div>

      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-green-800">¡Producto activado exitosamente!</p>
          <p className="text-sm text-green-600">El flujo event-driven fue ejecutado.</p>
        </div>
      </div>

      {product && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Producto ID:</span>
            <span className="font-mono font-medium">{product.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Título:</span>
            <span className="font-medium">{product.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estado:</span>
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">
              ✓ Activo
            </span>
          </div>
        </div>
      )}

      <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold">Verificar en los logs del backend:</p>
        <code className="block bg-blue-100 rounded p-2 font-mono whitespace-pre">
          {`[product.activated] productId=${product?.id}, merchantId=${product?.merchantId}, categoryId=${product?.categoryId}
Inventory initialization ready for product ${product?.id}`}
        </code>
      </div>

      <button
        onClick={onReset}
        className="w-full border border-[#c1292e] text-[#c1292e] hover:bg-red-50 font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
      >
        Repetir demo con otro producto →
      </button>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c1292e]"
      />
    </div>
  );
}

function ArchBadge({
  label,
  color,
  note,
}: {
  label: string;
  color: 'blue' | 'gray' | 'red' | 'green';
  note: string;
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    red: 'bg-red-50 border-red-200 text-[#c1292e]',
    green: 'bg-green-50 border-green-200 text-green-800',
  };
  return (
    <div className={`border rounded-lg px-3 py-2 flex-shrink-0 text-center ${colors[color]}`}>
      <p className="font-mono text-xs font-semibold whitespace-nowrap">{label}</p>
      <p className="text-xs opacity-70 whitespace-nowrap">{note}</p>
    </div>
  );
}

function Arrow() {
  return <div className="text-gray-400 font-bold flex-shrink-0">→</div>;
}
