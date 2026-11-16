import { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";

interface Tarea {
  id: number;
  titulo: string;
  descripcion: string;
  precio: number;
}

const STORAGE_KEY = "presupuestador_v1_data";

// Límites máximos de caracteres por campo
const LIMITES = {
  tituloTrabajo: 60,
  cliente: 40,
  validez: 20,
  tituloTarea: 65,
  descTarea: 180,
  precioTarea: 12,
} as const;

interface DatosGuardados {
  cliente: string;
  tituloTrabajo: string;
  validez: string;
  tareas: Tarea[];
}

function cargarEstadoInicial(): DatosGuardados {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { cliente: "", tituloTrabajo: "", validez: "15 días", tareas: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      cliente: typeof parsed.cliente === "string" ? parsed.cliente : "",
      tituloTrabajo: typeof parsed.tituloTrabajo === "string" ? parsed.tituloTrabajo : "",
      validez: typeof parsed.validez === "string" ? parsed.validez : "15 días",
      tareas: Array.isArray(parsed.tareas) ? parsed.tareas : [],
    };
  } catch {
    return { cliente: "", tituloTrabajo: "", validez: "15 días", tareas: [] };
  }
}

export default function App() {
  const inicial = useRef<DatosGuardados>(cargarEstadoInicial()).current;

  // Datos generales
  const [cliente, setCliente] = useState(inicial.cliente);
  const [tituloTrabajo, setTituloTrabajo] = useState(inicial.tituloTrabajo);
  const [validez, setValidez] = useState(inicial.validez);

  // Estado de tareas y selección
  const [tareas, setTareas] = useState<Tarea[]>(inicial.tareas);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);

  // Campos para nueva tarea / edición
  const [tituloTarea, setTituloTarea] = useState("");
  const [descTarea, setDescTarea] = useState("");
  const [precioTarea, setPrecioTarea] = useState("");
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const [generando, setGenerando] = useState(false);
  const plantillaRef = useRef<HTMLDivElement>(null);
  const formTareaRef = useRef<HTMLElement>(null);

  // Guardar automáticamente en localStorage ante cualquier cambio
  useEffect(() => {
    try {
      const payload: DatosGuardados = {
        cliente,
        tituloTrabajo,
        validez,
        tareas,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error("No se pudo guardar en localStorage:", err);
    }
  }, [cliente, tituloTrabajo, validez, tareas]);

  // Normaliza coma decimal de teclados móviles en español
  const parsearPrecio = (valor: string): number => {
    if (!valor) return NaN;
    const limpio = valor.replace(/\$/g, "").replace(/\s/g, "").replace(",", ".");
    return parseFloat(limpio);
  };

  const precioNumerico = parsearPrecio(precioTarea);
  const formularioValido =
    tituloTarea.trim().length > 0 &&
    tituloTarea.trim().length <= LIMITES.tituloTarea &&
    descTarea.trim().length <= LIMITES.descTarea &&
    !isNaN(precioNumerico) &&
    precioNumerico > 0;

  const limpiarFormularioTarea = () => {
    setTituloTarea("");
    setDescTarea("");
    setPrecioTarea("");
    setEditandoId(null);
  };

  const guardarTarea = () => {
    if (!formularioValido) return;

    const tituloLimpio = tituloTarea.trim().slice(0, LIMITES.tituloTarea);
    const descLimpia = descTarea.trim().slice(0, LIMITES.descTarea);

    if (editandoId !== null) {
      setTareas((prev) =>
        prev.map((t) =>
          t.id === editandoId
            ? { ...t, titulo: tituloLimpio, descripcion: descLimpia, precio: precioNumerico }
            : t
        )
      );
    } else {
      const nueva: Tarea = {
        id: Date.now(),
        titulo: tituloLimpio,
        descripcion: descLimpia,
        precio: precioNumerico,
      };
      setTareas((prev) => [...prev, nueva]);
    }

    limpiarFormularioTarea();
  };

  const iniciarEdicion = (e: React.MouseEvent, tarea: Tarea) => {
    e.stopPropagation();
    setEditandoId(tarea.id);
    setTituloTarea(tarea.titulo);
    setDescTarea(tarea.descripcion);
    setPrecioTarea(String(tarea.precio));
    formTareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Reordenar tareas (subir o bajar un ítem)
  const moverTarea = (e: React.MouseEvent, index: number, direccion: "arriba" | "abajo") => {
    e.stopPropagation();
    const nuevoIndex = direccion === "arriba" ? index - 1 : index + 1;
    if (nuevoIndex < 0 || nuevoIndex >= tareas.length) return;

    setTareas((prev) => {
      const copia = [...prev];
      const [itemMovido] = copia.splice(index, 1);
      copia.splice(nuevoIndex, 0, itemMovido);
      return copia;
    });
  };

  // Maneja el "Enter" en el teclado del celular sin recargar la página
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      guardarTarea();
    }
  };

  // Selección individual
  const toggleSeleccion = (id: number) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Eliminar las tareas marcadas con checkbox
  const eliminarSeleccionadas = () => {
    if (editandoId !== null && seleccionadas.includes(editandoId)) {
      limpiarFormularioTarea();
    }
    setTareas((prev) => prev.filter((t) => !seleccionadas.includes(t.id)));
    setSeleccionadas([]);
  };

  // Vaciar solo la lista de tareas
  const eliminarTodasLasTareas = () => {
    setTareas([]);
    setSeleccionadas([]);
    limpiarFormularioTarea();
  };

  // Limpiar absolutamente toda la información del presupuesto y localStorage
  const limpiarTodoElPresupuesto = () => {
    const hayDatos =
      tituloTrabajo.trim() !== "" ||
      cliente.trim() !== "" ||
      tareas.length > 0 ||
      tituloTarea.trim() !== "" ||
      precioTarea !== "";

    if (hayDatos && !window.confirm("¿Borrar todos los datos y empezar un presupuesto nuevo?")) {
      return;
    }

    setTituloTrabajo("");
    setCliente("");
    setValidez("15 días");
    setTareas([]);
    setSeleccionadas([]);
    limpiarFormularioTarea();
    localStorage.removeItem(STORAGE_KEY);
  };

  const total = tareas.reduce((acc, t) => acc + t.precio, 0);

  const nombreArchivo = () => {
    const base = tituloTrabajo.trim() || cliente.trim() || "presupuesto";
    return `presupuesto-${base.toLowerCase().replace(/\s+/g, "-")}.png`;
  };

  const descargarImagen = async () => {
    if (!plantillaRef.current) return;
    setGenerando(true);
    try {
      const dataUrl = await toPng(plantillaRef.current, {
        pixelRatio: 2,
        backgroundColor: "#4f4b4a",
      });

      const link = document.createElement("a");
      link.download = nombreArchivo();
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error al descargar:", err);
      alert("Hubo un error al generar la imagen.");
    } finally {
      setGenerando(false);
    }
  };

  const filtrarInputPrecio = (raw: string) => {
    const soloNumerosYDecimal = raw.replace(/[^0-9.,]/g, "");
    const partes = soloNumerosYDecimal.split(/[.,]/);
    const normalizado =
      partes.length > 2
        ? `${partes[0]}.${partes.slice(1).join("")}`
        : soloNumerosYDecimal;

    return normalizado.slice(0, LIMITES.precioTarea);
  };

  return (
    <div className="min-h-screen bg-[#4f4b4a] text-white">
      <main className="max-w-md mx-auto p-4 pb-12 space-y-6">
        {/* CABECERA CON LOGO Y BOTÓN PARA LIMPIAR TODO */}
        <div className="flex justify-between items-center pt-1">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Logo Pergolas C y M"
              className="w-12 h-12 object-contain rounded-full border border-white/30"
            />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Presupuestos
            </h1>
          </div>
          <button
            type="button"
            onClick={limpiarTodoElPresupuesto}
            className="text-xs font-bold text-red-200 bg-red-950/80 hover:bg-red-900 active:bg-red-800 border border-red-500 px-3 py-2 rounded-lg transition-colors"
          >
            Limpiar todo
          </button>
        </div>

        {/* 1. DATOS DEL PRESUPUESTO */}
        <section className="bg-[#2B2928] p-4 rounded-xl shadow-md border border-neutral-500 space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Datos Generales
          </h2>
          <div>
            <input
              type="text"
              maxLength={LIMITES.tituloTrabajo}
              placeholder="Título del trabajo (ej: Pérgola de hierro y madera)"
              value={tituloTrabajo}
              onChange={(e) => setTituloTrabajo(e.target.value.slice(0, LIMITES.tituloTrabajo))}
              className="w-full p-3 bg-[#4f4b4a] text-white font-medium placeholder-neutral-300 border border-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-[11px] font-medium text-neutral-300 text-right mt-0.5">
              {tituloTrabajo.length}/{LIMITES.tituloTrabajo}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="text"
                maxLength={LIMITES.cliente}
                placeholder="Cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value.slice(0, LIMITES.cliente))}
                className="w-full p-3 bg-[#4f4b4a] text-white font-medium placeholder-neutral-300 border border-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[11px] font-medium text-neutral-300 text-right mt-0.5">
                {cliente.length}/{LIMITES.cliente}
              </p>
            </div>
            <div>
              <input
                type="text"
                maxLength={LIMITES.validez}
                placeholder="Validez (ej: 15 días)"
                value={validez}
                onChange={(e) => setValidez(e.target.value.slice(0, LIMITES.validez))}
                className="w-full p-3 bg-[#4f4b4a] text-white font-medium placeholder-neutral-300 border border-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-[11px] font-medium text-neutral-300 text-right mt-0.5">
                {validez.length}/{LIMITES.validez}
              </p>
            </div>
          </div>
        </section>

        {/* 2. CARGA / EDICIÓN DE TAREA */}
        <section
          ref={formTareaRef}
          className={`bg-[#2B2928] p-4 rounded-xl shadow-md border space-y-3 transition-colors ${
            editandoId !== null ? "border-amber-400 ring-2 ring-amber-400/30" : "border-neutral-500"
          }`}
        >
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              {editandoId !== null ? "Editando Tarea" : "Agregar Tarea"}
            </h2>
            {editandoId !== null && (
              <button
                type="button"
                onClick={limpiarFormularioTarea}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div>
            <input
              type="text"
              maxLength={LIMITES.tituloTarea}
              placeholder="Título de la tarea *"
              value={tituloTarea}
              onChange={(e) => setTituloTarea(e.target.value.slice(0, LIMITES.tituloTarea))}
              onInput={(e) =>
                setTituloTarea((e.target as HTMLInputElement).value.slice(0, LIMITES.tituloTarea))
              }
              onKeyDown={handleKeyDown}
              className="w-full p-3 bg-[#4f4b4a] text-white font-medium placeholder-neutral-300 border border-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <p className="text-[11px] font-medium text-neutral-300 text-right mt-0.5">
              {tituloTarea.length}/{LIMITES.tituloTarea}
            </p>
          </div>

          <div>
            <textarea
              maxLength={LIMITES.descTarea}
              placeholder="Descripción / detalles (opcional)"
              value={descTarea}
              onChange={(e) => setDescTarea(e.target.value.slice(0, LIMITES.descTarea))}
              onInput={(e) =>
                setDescTarea((e.target as HTMLTextAreaElement).value.slice(0, LIMITES.descTarea))
              }
              rows={2}
              className="w-full p-3 bg-[#4f4b4a] text-white font-medium placeholder-neutral-300 border border-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <p className="text-[11px] font-medium text-neutral-300 text-right mt-0.5">
              {descTarea.length}/{LIMITES.descTarea}
            </p>
          </div>

          <div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                maxLength={LIMITES.precioTarea}
                placeholder="Precio (> 0) *"
                value={precioTarea}
                onChange={(e) => setPrecioTarea(filtrarInputPrecio(e.target.value))}
                onInput={(e) =>
                  setPrecioTarea(filtrarInputPrecio((e.target as HTMLInputElement).value))
                }
                onKeyDown={handleKeyDown}
                className="flex-1 p-3 bg-[#4f4b4a] text-white font-semibold placeholder-neutral-300 border border-neutral-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="button"
                onClick={guardarTarea}
                disabled={!formularioValido}
                className={`px-5 rounded-lg font-extrabold text-xl text-neutral-950 transition-colors disabled:bg-neutral-600 disabled:text-neutral-400 ${
                  editandoId !== null
                    ? "bg-amber-400 active:bg-amber-500"
                    : "bg-white active:bg-neutral-200"
                }`}
              >
                {editandoId !== null ? "✓" : "+"}
              </button>
            </div>
            {precioTarea !== "" && (!isNaN(precioNumerico) ? precioNumerico <= 0 : true) && (
              <p className="text-xs font-semibold text-red-300 mt-1">
                El precio debe ser mayor a 0.
              </p>
            )}
          </div>
        </section>

        {/* 3. LISTA DE TAREAS Y ACCIONES DE BORRADO / EDICIÓN / REORDEN */}
        {tareas.length > 0 && (
          <section className="bg-[#2B2928] p-4 rounded-xl shadow-md border border-neutral-500 space-y-3">
            <div className="flex justify-between items-center border-b border-neutral-500 pb-2">
              <span className="text-sm font-bold text-white">
                Tareas ({tareas.length})
              </span>
              <div className="flex gap-2">
                {seleccionadas.length > 0 && (
                  <button
                    type="button"
                    onClick={eliminarSeleccionadas}
                    className="text-xs bg-amber-900/80 text-amber-100 border border-amber-500 px-2.5 py-1.5 rounded-md font-bold"
                  >
                    Borrar marcadas ({seleccionadas.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={eliminarTodasLasTareas}
                  className="text-xs bg-red-950/80 text-red-200 border border-red-500 px-2.5 py-1.5 rounded-md font-bold"
                >
                  Vaciar lista
                </button>
              </div>
            </div>

            <ul className="divide-y divide-neutral-600">
              {tareas.map((t, index) => {
                const estaMarcada = seleccionadas.includes(t.id);
                const estaSiendoEditada = editandoId === t.id;
                return (
                  <li
                    key={t.id}
                    onClick={() => toggleSeleccion(t.id)}
                    className={`py-3 flex items-center gap-2.5 cursor-pointer transition-colors ${
                      estaSiendoEditada
                        ? "bg-amber-950/60 -mx-2 px-2 rounded-lg"
                        : estaMarcada
                        ? "bg-neutral-700/80 -mx-2 px-2 rounded-lg"
                        : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={estaMarcada}
                      onChange={() => {}}
                      className="w-5 h-5 rounded border-neutral-300 accent-amber-400 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-base break-words">
                        <span className="text-amber-300 mr-1.5">{index + 1}.</span>
                        {t.titulo}
                      </p>
                      {t.descripcion && (
                        <p className="text-sm text-neutral-100 break-words mt-0.5">
                          {t.descripcion}
                        </p>
                      )}
                      <p className="font-extrabold text-amber-300 text-base mt-1">
                        ${t.precio.toLocaleString("es-AR")}
                      </p>
                    </div>

                    {/* Controles de orden y edición */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tareas.length > 1 && (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={(e) => moverTarea(e, index, "arriba")}
                            disabled={index === 0}
                            aria-label="Subir tarea"
                            className="w-7 h-6 flex items-center justify-center text-xs bg-[#4f4b4a] hover:bg-neutral-600 active:bg-neutral-500 text-white border border-neutral-400 rounded disabled:opacity-30"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={(e) => moverTarea(e, index, "abajo")}
                            disabled={index === tareas.length - 1}
                            aria-label="Bajar tarea"
                            className="w-7 h-6 flex items-center justify-center text-xs bg-[#4f4b4a] hover:bg-neutral-600 active:bg-neutral-500 text-white border border-neutral-400 rounded disabled:opacity-30"
                          >
                            ▼
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => iniciarEdicion(e, t)}
                        aria-label="Editar tarea"
                        className="text-xs font-bold text-white bg-[#4f4b4a] hover:bg-neutral-600 active:bg-neutral-500 border border-neutral-400 px-2.5 py-2 rounded-md"
                      >
                        Editar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="pt-3 border-t border-neutral-500 flex justify-between items-center text-lg font-extrabold">
              <span className="text-white">Total estimado:</span>
              <span className="text-amber-300 text-xl">${total.toLocaleString("es-AR")}</span>
            </div>
          </section>
        )}

        {/* 4. BOTÓN DE DESCARGA */}
        <section>
          <button
            type="button"
            onClick={descargarImagen}
            disabled={tareas.length === 0 || generando}
            className="w-full py-3.5 px-4 bg-white active:bg-neutral-200 text-neutral-950 font-extrabold text-base rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 shadow-md transition-colors"
          >
            {generando ? "Generando imagen..." : "⬇ Descargar Presupuesto (PNG)"}
          </button>
        </section>

        {/* 5. PLANTILLA OCULTA QUE SE RENDERIZA COMO IMAGEN (Fondo #4f4b4a, logo grande y texto blanco de alto contraste) */}
        <div className="overflow-hidden h-0 z-0">
          <div ref={plantillaRef} className="w-[1000px] p-10 bg-[#4f4b4a] text-white font-sans">
            {/* Encabezado: Empresa a la izquierda, Logo bien grande en el medio, Contacto a la derecha */}
            <header className="grid grid-cols-[1fr_auto_1fr] items-center border-b-2 border-white pb-6 mb-6 gap-5">
              {/* Izquierda: Nombre de empresa */}
              <div className="text-left">
                <h2 className="text-3xl font-extrabold uppercase tracking-tight text-white leading-tight drop-shadow-sm">
                  Pergolas C y M
                </h2>
                <p className="text-base font-bold text-neutral-100 mt-1">
                  Herrería y Pérgolas
                </p>
              </div>

              {/* Centro: Logo grande */}
              <div className="flex justify-center">
                <img
                  src="/logo.png"
                  alt="Logo Pergolas C y M"
                  className="w-48 h-48 object-contain rounded-full shadow-lg"
                />
              </div>

              {/* Derecha: WhatsApp, Instagram, Fecha y Validez */}
              <div className="text-right text-sm text-white space-y-2">
                {/* Teléfonos con ícono de WhatsApp */}
                <div className="font-bold text-white space-y-1 text-base">
                  <p className="flex items-center justify-end gap-1.5">
                    <svg
                      className="w-4 h-4 text-green-400 shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                      <path d="M12 2C6.486 2 2 6.486 2 12c0 1.771.466 3.504 1.351 5.025L2 22l5.117-1.341A9.93 9.93 0 0 0 12 22c5.514 0 10-4.486 10-10S17.514 2 12 2zm0 18.182c-1.573 0-3.112-.423-4.455-1.223l-.32-.19-3.314.868.885-3.23-.208-.332A8.146 8.146 0 0 1 3.818 12c0-4.511 3.671-8.182 8.182-8.182 4.511 0 8.182 3.671 8.182 8.182 0 4.511-3.671 8.182-8.182 8.182z" />
                    </svg>
                    <span>+54 9 2241 69-0276</span>
                  </p>
                  <p className="flex items-center justify-end gap-1.5">
                    <svg
                      className="w-4 h-4 text-green-400 shrink-0"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                      <path d="M12 2C6.486 2 2 6.486 2 12c0 1.771.466 3.504 1.351 5.025L2 22l5.117-1.341A9.93 9.93 0 0 0 12 22c5.514 0 10-4.486 10-10S17.514 2 12 2zm0 18.182c-1.573 0-3.112-.423-4.455-1.223l-.32-.19-3.314.868.885-3.23-.208-.332A8.146 8.146 0 0 1 3.818 12c0-4.511 3.671-8.182 8.182-8.182 4.511 0 8.182 3.671 8.182 8.182 0 4.511-3.671 8.182-8.182 8.182z" />
                    </svg>
                    <span>+54 9 2241 47-3591</span>
                  </p>
                </div>

                {/* Instagram */}
                <div className="text-sm font-semibold text-white">
                  <p className="flex items-center justify-end gap-1.5">
                    <svg
                      className="w-4 h-4 text-pink-400 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                    >
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    <span>@pergola.cym</span>
                  </p>
                </div>

                {/* Fecha y validez */}
                <div className="pt-2 text-xs font-bold text-neutral-100 border-t border-white/40">
                  <span>Fecha: {new Date().toLocaleDateString("es-AR")}</span>
                  {validez && (
                    <>
                      <span className="mx-1.5">|</span>
                      <span>Validez: {validez}</span>
                    </>
                  )}
                </div>
              </div>
            </header>

            {/* Bloque de Título del Trabajo y Cliente */}
            {(tituloTrabajo || cliente) && (
              <div className="bg-[#232120] p-4 rounded-lg mb-6 border border-black flex justify-between items-center">
                <div>
                  <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300 block">
                    Presupuesto por
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mt-0.5">
                    {tituloTrabajo || "Detalle de Servicios"}
                  </h3>
                </div>
                {cliente && (
                  <div className="text-right">
                    <span className="text-xs uppercase font-extrabold tracking-wider text-amber-300 block">
                      Cliente
                    </span>
                    <p className="text-xl font-bold text-white mt-0.5">{cliente}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tabla de Tareas con bordes negros, numeración y letras blancas bien marcadas */}
            <table className="w-full mb-8 text-left border-collapse border-2 border-black">
              <thead>
                <tr className="bg-[#1F1D1C] text-white text-sm font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-3 border border-black w-12 text-center">#</th>
                  <th className="py-3 px-4 border border-black">Tarea / Descripción</th>
                  <th className="py-3 px-4 border border-black text-right w-40">Importe</th>
                </tr>
              </thead>
              <tbody>
                {tareas.map((t, index) => {
                  const esPar = (index + 1) % 2 === 0;
                  return (
                    <tr key={t.id} className={esPar ? "bg-[#2C2928]" : "bg-[#4f4b4a]"}>
                      <td className="py-4 px-3 border border-black text-center font-extrabold text-white text-2xl align-top">
                        {index + 1}
                      </td>
                      <td className="py-4 px-4 border border-black align-top">
                        <p className="font-extrabold text-white text-2xl leading-snug break-words">
                          {t.titulo}
                        </p>
                        {t.descripcion && (
                          <p className="text-xl font-medium text-neutral-100 mt-1 whitespace-pre-line break-words">
                            {t.descripcion}
                          </p>
                        )}
                      </td>
                      <td className="py-4 px-4 border border-black text-right font-extrabold text-white text-lg align-top">
                        ${t.precio.toLocaleString("es-AR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Total */}
            <div className="flex justify-end">
              <div className="bg-[#1F1D1C] border-2 border-black text-white px-8 py-4 rounded-lg text-right">
                <span className="text-neutral-100 text-base font-extrabold uppercase tracking-wider mr-4">
                  Total
                </span>
                <span className="text-3xl font-extrabold text-white">
                  ${total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}