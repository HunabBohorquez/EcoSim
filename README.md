# EcoSim — Simulador de Ecosistema Depredador-Presa

> **Enlaces del proyecto**

**Link:** `https://hunabbohorquez.github.io/EcoSim/`

**Repositorio en GitHub:** `https://github.com/HunabBohorquez/EcoSim`

> 📝 **Nota:** este proyecto tiene los **mismos archivos** que el repositorio de GitLab
> (`index.html`, `styles.css`, `app.js`, `README.md`). Solo cambia la plataforma de alojamiento.

---

## 📖 Descripción del Proyecto
**EcoSim** es una simulación computacional de vida artificial basada en una cuadrícula celular. Modeliza la dinámica poblacional y el flujo de energía a través de tres niveles tróficos (Plantas, Herbívoros y Depredadores) utilizando reglas deterministas y mecánicas estocásticas limitadas mediante un generador de números pseudoaleatorios (PRNG). 

El proyecto fue desarrollado exclusivamente con HTML5, CSS3 y JavaScript ES6+ (Vanilla), demostrando una arquitectura modular orientada a objetos sin dependencias de librerías de terceros (cero React, nulo P5.js).

## ⚙️ Reglas de Transición y Energía

El ecosistema procesa un tick por ciclo. Para evitar el "sesgo de direccionalidad o barrido", el motor recopila las coordenadas de todas las celdas, las somete a un barajado de Fisher-Yates, y procesa cada agente en ese orden.

1. **Plantas (Verde):**
   - No poseen energía mecánica dinámica.
   - Brotación Espontánea: Las celdas vacías tienen una probabilidad según el valor "% Tasa de crecimiento" de originar una nueva planta en cada tick.

2. **Herbívoros (Azul / Cian):**
   - Sobrevivencia: Consumen `-1 de energía` en cada tick. Si su energía baja a `0`, mueren de inanición.
   - Alimentación: Si existe una Planta contigua, se desplazan a esa casilla consumiéndola e incrementando su energía (según el slider "Energía por Planta").
   - Movimiento: Si no hay alimento vecino, se mueven aleatoriamente a una casilla adyacente vacía.
   - Reproducción: Si su nivel energético rebasa el *Umbral de Reproducción*, su energía se divide a la mitad y generan una cría en la casilla que acaban de dejar.

3. **Depredadores (Rojo / Naranja):**
   - Sobrevivencia: Consumen `-1 de energía` por tick. Mueren si llega a `0`.
   - Caza: Si hay un Herbívoro contiguo, lo atacan, ocupando su celda, devorándolo y ganando energía ("Energía por Presa").
   - Movimiento y Reproducción: Misma lógica de búsqueda vacía y división mitótica celular que los herbívoros al alcanzar el umbral de reproducción.

## 🚀 Instrucciones de Ejecución
Este entorno no requiere compilación, bundlers o servidores locales para correr, pero funcionará perfectamente si los tienes.

1. Asegúrate de que los cuatro archivos (`index.html`, `styles.css`, `app.js`, `README.md`) estén guardados dentro de la misma carpeta.
2. Da doble clic sobre el archivo `index.html` para abrirlo en cualquier navegador web moderno (Chrome, Firefox, Safari, Edge).
3. Haz clic en "Iniciar ▶️" o usa los presets calibrados del menú lateral izquierdo.

## 🧪 Pruebas Verificables

La plataforma cuenta con 3 escenarios (*Presets*) listos para su validación computacional:

* **Equilibrio Dinámico:**
  - *Conteos Iniciales:* 300 Plantas, 150 Herbívoros, 40 Depredadores.
  - *Comportamiento esperado:* La población oscila siguiendo un modelo similar a las ecuaciones de Lotka-Volterra. El ecosistema se sostiene sin extinguirse prematuramente.

* **Sobredepredación (Colapso):**
  - *Conteos Iniciales:* 200 Plantas, 100 Herbívoros, 200 Depredadores (Tasa de repro. rápida = 15).
  - *Comportamiento esperado:* Los depredadores arrasan con los herbívoros en pocos ticks. El banner "¡Alerta de Extinción!" aparecerá para herbívoros y, enseguida, los depredadores morirán de inanición masiva al quedarse sin presas.

* **Explosión Demográfica:**
  - *Conteos Iniciales:* 500 Plantas, 200 Herbívoros, 0 Depredadores. (Tasa crecimiento vegetal alto).
  - *Comportamiento esperado:* Sin depredadores naturales, los herbívoros se reproducen libremente saturando la pantalla de color cian hasta consumir todas las plantas y encontrar un nuevo límite de capacidad de carga restrictiva basada en la inanición.
