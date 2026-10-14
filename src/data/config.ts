// ============================================================================
// CFG — ÚNICO lugar con números de balance. Todos los valores son ilustrativos.
// Si tocás algo acá: `npm test && npm run sim` y mirá la tabla.
// Unidades: indicadores en % anual (crecimiento, inflación), % PBI (deuda, gasto),
// meses de importaciones (reservas), 0-100 (aprobación, gobernabilidad, estabilidad).
// ============================================================================

export const CFG = {
  turnosMandato: 16, // 1 turno = 1 trimestre; 16 = 4 años
  trimestresPorAnio: 4,

  // ---------------------------------------------------------------- Fiscal
  fiscal: {
    // Emitir 1% del PBI (anualizado) en un trimestre suma esto de inflación (pp), antes del
    // multiplicador del país. Es la perilla principal del "populismo con maquinita".
    emisionInflacion: 2.2,
    emisionReservas: 0.35, // meses de reservas que se pierden por cada 1% PBI emitido
    // La inflación licúa deuda, pero solo una parte (deuda en dólares no se licúa).
    licuacionInflacion: 0.15,
    licuacionTopeInflacion: 40,
    // Pagar menos que los intereses: lo impago se capitaliza y sube la prima.
    primaPorAtraso: 1.2,
    mixtoParteDeuda: 0.5, // en modo mixto, qué parte del déficit va a deuda
    impuestosMin: 10,
    impuestosMax: 45,
    areaMax: 20, // % PBI máximo por área (para que los sliders tengan techo)
  },

  // Prima de riesgo objetivo (pp) = base + exceso de deuda + atraso + inflación - reservas.
  prima: {
    base: 1.0,
    umbralDeuda: 60, // por encima de este % PBI, cada punto suma
    porDeuda: 0.06,
    porInflacion: 0.02, // por punto de inflación sobre 20
    umbralInflacion: 20,
    porReservas: 0.15, // resta por mes de reservas
    min: 0.3,
    max: 20,
    suavizado: 0.35, // qué fracción del gap se cierra por turno
  },

  // ---------------------------------------------------------------- Economía
  economia: {
    anclaInflacion: 4, // hacia dónde converge la inflación sin impulsos
    inflacionMin: -2,
    inflacionMax: 2000,
    reservasCriticas: 3, // por debajo de esto hay presión cambiaria (devaluación => inflación)
    devaluacionPorMes: 4, // pp de inflación por cada mes de reservas faltante
    deficitInflacion: 0.25, // pp de inflación por punto de déficit sobre el umbral
    umbralDeficitInflacion: 3,
    // Crecimiento
    capitalRetencion: 0.92, // el stock de inversión se deprecia
    capitalAporte: 0.25,
    capitalEfecto: 0.5, // pp de crecimiento por unidad de capital acumulado
    capitalMax: 8,
    impulsoFiscal: 0.25, // pp de crecimiento por punto de gasto primario sobre la base (corto plazo)
    dragImpuestos: 0.25, // pp de crecimiento por punto de impuestos sobre la base
    dragInflacion: 0.03, // pp por punto de inflación sobre 10
    umbralDragInflacion: 10,
    dragPrima: 0.25, // pp de crecimiento por pp de prima
    suavizadoCrecimiento: 0.5,
    ruidoCrecimiento: 0.5,
    crecimientoMin: -15,
    crecimientoMax: 12,
    okun: 0.35, // pp de desempleo por pp de crecimiento bajo el potencial (anualizado)
    reversionDesempleo: 0.05,
    desempleoMin: 2,
    desempleoMax: 40,
    reservasDeriva: 0.08,
    reservasPorSuperavit: 0.06, // meses por punto de superávit (anualizado) por trimestre
    reservasPorAtraso: 0.4,
    reservasPorInflacion: 0.0025, // fuga por punto de inflación
    reservasMax: 24,
    deudaMax: 250,
  },

  // ---------------------------------------------------------------- Política
  politica: {
    // Aprobación objetivo (antes de la presión). Los efectos de gasto son por punto sobre la base del país.
    aprobacionBase: 50,
    aprobPorAsistencia: 2.5,
    aprobPorSalud: 2.0,
    aprobPorEducacion: 1.0,
    aprobPorSeguridad: 2.0,
    aprobPorEnergia: 1.5, // subsidios a tarifas: populares
    aprobPorImpuestos: -1.8,
    aprobPorSubaInflacion: -0.45, // por punto de inflación por encima de la inicial
    aprobPorInflacion: -0.04, // castigo absoluto (pequeño)
    aprobPorSubaDesempleo: -2.0,
    aprobPorCrecimiento: 1.4,
    aprobPorEscandalo: -10,
    aprobPorPresion: -0.15,
    aprobSuavizado: 0.3,
    aprobRuido: 1.5,
    // Gobernabilidad: mitad apoyo legislativo (afinidad media ponderada por bancas), mitad aprobación.
    gobPesoCongreso: 0.55,
    gobPesoAprobacion: 0.45,
    gobPorPresion: -0.15,
    gobSuavizado: 0.35,
    // Afinidad de bloques: deriva hacia su base, corrida por la aprobación del gobierno.
    afinidadDeriva: 0.15,
    afinidadPorAprobacion: 0.8, // por punto de aprobación sobre/bajo 50
    // Estabilidad social
    estabilidadBase: 55,
    estabPorAsistencia: 3.0,
    estabPorSeguridad: 3.0,
    estabPorSalud: 1.0,
    estabPorSubaInflacion: -0.35,
    estabPorInflacion: -0.03,
    estabPorSubaDesempleo: -2.0,
    estabPorAprobacion: 0.2, // por punto sobre 50
    estabSuavizado: 0.3,
    // Capacidad militar (gancho Fase 3): converge lento según el gasto en defensa relativo a la base.
    militarBase: 50,
    militarPorDefensa: 25, // por cada 100% de aumento relativo sobre la base
    militarSuavizado: 0.1,
  },

  // ---------------------------------------------------------------- Congreso
  congreso: {
    pesoAfinidad: 0.6,
    pesoAprobacion: 0.4, // por punto de aprobación sobre 50
    porConcesion: 14, // puntos de "ganas de votar" por punto de concesión
    escala: 18, // ancho del sigmoide: más alto = más azaroso
    ruidoVoto: 0.12, // desvío en bloques indisciplinados
    costoConcesion: 0.5, // % PBI (anualizado, solo este trimestre) por punto de concesión
    concesionMax: 3,
    afinidadPorConcesion: 3, // lo que sube la afinidad del bloque premiado
    enojoOposicion: 1.5, // lo que baja la afinidad de opositores no premiados, por punto repartido
    bonoAprobada: 6, // gobernabilidad
    costoFracaso: 8, // gobernabilidad
  },

  // ---------------------------------------------------------------- Eventos
  eventos: {
    probBase: 0.55, // chance de que haya al menos un evento en el turno
    probPorPresion: 0.004,
    probSegundo: 0.18, // chance de un segundo evento
    multNegativoPorPresion: 0.012, // los eventos malos pesan más con presión
    duracionEscandalo: 3,
  },

  // ---------------------------------------------------------------- Presión
  presion: {
    porTurno: 2.2,
    porDesaprobacion: 0.06, // por punto de aprobación bajo 45
    umbralDesaprobacion: 45,
    max: 100,
  },

  // ---------------------------------------------------------------- Finales
  finales: {
    gobCritica: 22,
    turnosGobCritica: 3,
    inflacionColapso: 400,
    reservasColapso: 0.3,
    atrasoColapso: 2,
    deudaColapso: 180,
    golpeEstabilidad: 20,
    golpeGobernabilidad: 25,
    golpeProbBase: 0.03,
    golpePorPunto: 0.008, // por punto bajo los umbrales
    juicioAfinidadHostil: -20, // un bloque con afinidad menor es "hostil"
    juicioUmbralBancas: 0.45, // fracción de bancas hostiles necesaria para que prospere
    juicioProbBase: 0.12,
    juicioPorDesaprobacion: 0.006, // por punto de aprobación bajo 40
  },

  // ---------------------------------------------------------------- Diplomacia (Fase 2)
  diplomacia: {
    relacionDefault: 20, // pares que no figuran en relations.json
    deriva: 0.06, // fracción del gap hacia la relación base que se cierra por turno
    accionesPorTurno: 2,
    bonoRatificacion: 2, // gobernabilidad por tratado ratificado (menos que una ley: se firman muchos)
    acciones: {
      // Ganancia con rendimientos decrecientes: se multiplica por (100 - relación) / 100.
      visita: { relacion: 10 },
      cooperacion: { relacion: 6, estabilidad: 1.5, relacionMin: 0 },
      protesta: { relacion: -10, aprobacionEnCrisis: 2.5 },
      gesto: { relacion: -8, aprobacion: 2 }, // "pegarle al vecino" rinde puertas adentro
    },
    tratados: {
      comercio: {
        relacionMin: 30,
        crecimiento: 0.35, // pp de crecimiento × pesoComercial del socio
        reservas: 0.06, // meses por turno × pesoComercial
        // Techos: abrir mercados rinde, pero con rendimientos decrecientes (si no, firmar todo domina).
        topeCrecimiento: 0.3,
        topeReservas: 0.08,
        apoyo: { oficialismo: 20, aliado: 15, centro: 15, opositor: 0, regional: 10 },
      },
      defensa: {
        relacionMin: 50,
        militar: 6, // puntos de capacidad militar objetivo (una sola vez, no se apila)
        alivioCrisis: 0.5, // multiplicador de los costos de escalar si tenés aliado defensivo
        apoyo: { oficialismo: 15, aliado: 10, centro: 0, opositor: -10, regional: 0 },
      },
      integracion: {
        relacionMin: 35,
        crecimiento: 0.2, // una sola vez: pertenecer al bloque, no importa con cuántos socios
        prima: -0.5, // pp de prima de riesgo (solo al firmar el primer acuerdo)
        deficitMax: 4, // obligación: déficit máximo
        castigoRelacion: 4, // por turno que incumplís (emitir o pasarte del déficit)
        apoyo: { oficialismo: 20, aliado: 10, centro: 5, opositor: -15, regional: -5 },
      },
    },
    crisis: {
      umbral: 12, // relación con un vecino por debajo de esto puede disparar una crisis
      probBase: 0.03,
      probPorPunto: 0.006,
      probMax: 0.35,
      relacionResuelta: 25, // con esta relación la crisis se cierra sola
      negociar: { aprobacion: -2, relacion: 8 },
      escalar: { aprobacion: 3, reservas: -0.4, crecimiento: -0.4, prima: 0.3, relacion: -10 },
      ignorar: { estabilidad: -2 },
      porNivel: { reservas: -0.12, crecimiento: -0.15, estabilidad: -0.8 }, // por turno y por nivel
      mediacionNivel3: 0.3, // chance por turno de que la mediación internacional baje un nivel
    },
    legadoPorRelacion: 0.2, // puntos de soberanía por punto de mejora de la relación promedio
  },

  // ---------------------------------------------------------------- Legado
  legado: {
    pesos: { crecimiento: 0.2, estabilidad: 0.2, bienestar: 0.2, soberania: 0.2, aprobacion: 0.2 },
    crecPorPunto: 12, // sobre/bajo el potencial inicial, promedio del mandato
    estabPorLogInflacion: 25,
    estabPorEstabilidad: 0.4,
    bienPorDesempleo: 6,
    bienPorEstabilidad: 0.5,
    sobPorDeuda: 0.8,
    sobPorReservas: 4,
    sobPorMilitar: 0.15,
    umbralReeleccion: 50,
    ruidoReeleccion: 5,
    bonusReeleccion: 10,
    umbralVictoria: 55,
  },
} as const;

export type Config = typeof CFG;
