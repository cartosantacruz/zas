// Ejemplo usando la API Fetch
const geojsonUrl = 'https://raw.githubusercontent.com/cartosantacruz/zas/main/data/obras.geojson';

fetch(geojsonUrl)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json(); // Parsea el GeoJSON
    })
    .then(data => {
        console.log('Datos cargados exitosamente:', data);
        // Aquí agregas el código para agregar 'data' a tu mapa (ej: L.geoJSON(data).addTo(map))
    })
    .catch(error => {
        console.error('Hubo un problema con la operación fetch:', error);
    });


// **********************************************
// **** MAIN.JS CON LÓGICA DE MAPA, FILTROS Y KPI ****
// **********************************************

let map;
let capaObras = null;
let datosObrasGeoJSON = null;
let graficoLocalidades, graficoTipos; 

/**
 * Convierte un número grande a formato de millones o miles de millones (billones), 
 * devolviendo el valor formateado y la unidad. Esto se usa para el KPI de Monto Total.
 * @param {number} monto - El monto total.
 * @returns {{valor: string, unidad: string}}
 */
function formatearMontoParaKPI(monto) {
    if (monto >= 1e9) { // 1.000.000.000 (Mil Millones o Billón)
        // Formatea el valor a dos decimales (ej: "10,29")
        const valorCorto = (monto / 1e9).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return { 
            valor: `${valorCorto}`, // ej: "10,29"
            unidad: 'Mil Millones (ARS)' // Solo el texto de la unidad
        };
    }
    if (monto >= 1e6) { // 1.000.000 (Millones)
        const valorCorto = (monto / 1e6).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return { 
            valor: `${valorCorto}`, // ej: "5,50"
            unidad: 'Millones (ARS)' 
        };
    }
    // Si es menor a un millón, se muestra el valor completo sin unidad ni asterisco.
    return { 
        valor: monto.toLocaleString('es-AR', { minimumFractionDigits: 0 }), // ej: "500.000"
        unidad: '' 
    };
}


// Inicializa el mapa y carga los datos cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    // 1. Definición de las capas base (Leaflet)
    const argenmap = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', { attribution: '&copy; IGN', tms: true });

    const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
        maxZoom: 20, subdomains:['mt0','mt1','mt2','mt3'], attribution: 'Google Satellite'
    });
    
    const mapasBase = { 
        "Argenmap IGN": argenmap, 
        "Google Satélite": googleSat 
    };
    
    // 2. Inicializar el mapa
    map = L.map('mapid', { 
        center: [-48.8, -69.2], 
        zoom: 5, 
        layers: [argenmap]
    });
    
    map.attributionControl.setPrefix(''); 
    L.control.layers(mapasBase).addTo(map);

    // Enlazar los eventos de los filtros
    document.getElementById('btn-limpiar-filtros').onclick = limpiarFiltros; 
    document.getElementById('filtro-nombre').onkeyup = actualizarVistas;

    // Carga inicial de datos
    cargarDatosObras();
});

// Función para cargar los datos GeoJSON
function cargarDatosObras() {
    // La ruta es relativa al HTML (index.html)
    fetch('../data/obras.geojson')
        .then(response => {
            if (!response.ok) throw new Error('Error de red al cargar el GeoJSON (Revisa la ruta: ../data/obras.geojson)');
            return response.json();
        })
        .then(data => {
            console.log("✅ Datos GeoJSON cargados con éxito."); 
            datosObrasGeoJSON = data;
            poblarFiltros(data);
            actualizarVistas(); // Muestra los datos iniciales
        })
        .catch(error => console.error('❌ Error CRÍTICO al cargar o procesar obras.geojson (Revisa sintaxis JSON):', error));
}

// Función principal que filtra datos y actualiza todos los componentes de la vista
function actualizarVistas() {
    // 1. Obtener valores de filtros
    const localidadSeleccionada = document.getElementById('filtro-localidad').value;
    const organismoSeleccionado = document.getElementById('filtro-organismo').value;
    const tipoSeleccionado = document.getElementById('filtro-tipo').value;
    const textoBusqueda = document.getElementById('filtro-nombre').value.toLowerCase().trim();

    // 2. Limpiar la capa del mapa
    if (capaObras) {
        map.removeLayer(capaObras);
        capaObras = null; 
    }

    // 3. Filtrar los datos
    const datosFiltrados = {
        type: "FeatureCollection",
        features: datosObrasGeoJSON.features.filter(feature => {
            const prop = feature.properties;
            const nombreObra = prop.nombre ? prop.nombre.toLowerCase() : '';
            
            const cumpleFiltrosSelect = 
                (localidadSeleccionada === 'todas' || prop.localidad === localidadSeleccionada) &&
                (organismoSeleccionado === 'todos' || prop.organismo === organismoSeleccionado) &&
                (tipoSeleccionado === 'todos' || prop.tipo === tipoSeleccionado);
                
            const cumpleBusqueda = (textoBusqueda === '' || nombreObra.includes(textoBusqueda));

            return cumpleFiltrosSelect && cumpleBusqueda;
        })
    };

    // 4. Crear y añadir la capa GeoJSON al mapa
    capaObras = L.geoJSON(datosFiltrados, {
        onEachFeature: (feature, layer) => {
            if (feature.properties) {
                const p = feature.properties;
                // Formato para el popup (completo en moneda)
                const montoFormateadoPopup = (p.monto || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
                
                // Lógica para la barra de avance en el popup
                const avporr = p.avporr;
                let avanceHTML = '';
                
                if (avporr !== null && avporr !== undefined && parseFloat(avporr) >= 0) {
                    const avanceNumerico = parseFloat(avporr);
                    const avancePorcentaje = Math.min(100, avanceNumerico).toFixed(2); 
                    
                    avanceHTML = `
                        <p style="margin: 5px 0 0 0;"><strong>Avance:</strong> ${avancePorcentaje}%</p>
                        <div style="background-color: #e9ecef; border-radius: .25rem; height: 15px; margin-top: 5px; overflow: hidden;">
                            <div style="background-color: #28a745; height: 100%; width: ${avancePorcentaje}%; border-radius: .25rem; transition: width 0.5s;">
                            </div>
                        </div>
                    `;
                } else {
                    avanceHTML = '<p style="margin: 5px 0 0 0;"><strong>Avance:</strong> No reportado</p>';
                }

                layer.bindPopup(`
                    <div style="font-family: sans-serif; font-size: 14px;">
                        <h4 style="margin: 0 0 5px 0;">${p.nombre || 'Obra Sin Nombre'}</h4>
                        <p style="margin: 0;"><strong>Localidad:</strong> ${p.localidad || 'N/A'}</p>
                        <p style="margin: 0;"><strong>Tipo:</strong> ${p.tipo || 'N/A'}</p>
                        <p style="margin: 0;"><strong>Organismo:</strong> ${p.organismo || 'N/A'}</p>
                        <p style="margin: 0;"><strong>Estado:</strong> ${p.estado || 'N/A'}</p>
                        <p style="margin: 0;"><strong>Monto:</strong> ${montoFormateadoPopup}</p>
                        ${avanceHTML}
                    </div>
                `);
            }
        }
    }).addTo(map); 
    
    // 5. Ajustar el zoom del mapa (fitBounds)
    if (datosFiltrados.features.length > 0) {
        map.fitBounds(capaObras.getBounds(), { padding: [50, 50] });
    } else {
        map.setView([-48.8, -69.2], 5);
    }

    // 6. Actualizar todos los demás componentes
    actualizarKPIs(datosFiltrados);
    actualizarGraficos(datosFiltrados);
    actualizarTabla(datosFiltrados); 
}

// --- FUNCIÓN PARA POBLAR LOS FILTROS SELECT ---
function poblarFiltros(geojson) {
    // Extraer valores únicos y ordenarlos, filtrando valores nulos/vacíos
    const localidades = [...new Set(geojson.features.map(f => f.properties.localidad))].filter(v => v).sort();
    const organismos = [...new Set(geojson.features.map(f => f.properties.organismo))].filter(v => v).sort();
    const tipos = [...new Set(geojson.features.map(f => f.properties.tipo))].filter(v => v).sort();

    const filtroLocalidad = document.getElementById('filtro-localidad');
    const filtroOrganismo = document.getElementById('filtro-organismo');
    const filtroTipo = document.getElementById('filtro-tipo');

    // Generar las opciones del select
    filtroLocalidad.innerHTML = '<option value="todas">Todas</option>' + localidades.map(val => `<option value="${val}">${val}</option>`).join('');
    filtroOrganismo.innerHTML = '<option value="todos">Todos</option>' + organismos.map(val => `<option value="${val}">${val}</option>`).join('');
    filtroTipo.innerHTML = '<option value="todos">Todos</option>' + tipos.map(val => `<option value="${val}">${val}</option>`).join('');

    // Establecer valores iniciales
    filtroLocalidad.value = "todas";
    filtroOrganismo.value = "todos";
    filtroTipo.value = "todos";

    // Enlazar el evento onchange para refrescar la vista
    filtroLocalidad.onchange = actualizarVistas;
    filtroOrganismo.onchange = actualizarVistas;
    filtroTipo.onchange = actualizarVistas;
}

// --- FUNCIÓN PARA RESTABLECER LOS FILTROS ---
function limpiarFiltros() {
    document.getElementById('filtro-localidad').value = 'todas';
    document.getElementById('filtro-organismo').value = 'todos';
    document.getElementById('filtro-tipo').value = 'todos';
    document.getElementById('filtro-nombre').value = ''; 

    actualizarVistas();
}

// --- FUNCIÓN PARA ACTUALIZAR LOS KPIs ---
function actualizarKPIs(geojsonFiltrado) {
    const obras = geojsonFiltrado.features;
    const totalObras = obras.length;
    
    // Suma del monto total
    const montoTotal = obras.reduce((sum, obra) => sum + (parseFloat(obra.properties.monto) || 0), 0);
    
    // Aplicar formato para mostrar en Millones o Mil Millones
    const { valor: montoFormateado, unidad: unidadMonto } = formatearMontoParaKPI(montoTotal);

    // CÁLCULO DE OBRAS EN EJECUCIÓN (Busca la palabra 'ejecución' en el campo estado)
    const obrasEnEjecucion = obras.filter(obra => 
        obra.properties.estado && obra.properties.estado.toLowerCase().includes('ejecución')
    ).length; 
    
    // CÁLCULO DE OBRAS FINALIZADAS (Busca la palabra 'finalizada' en el campo estado)
    const obrasFinalizadas = obras.filter(obra => 
        obra.properties.estado && obra.properties.estado.toLowerCase().includes('finalizada')
    ).length; 
    
    // ASIGNACIÓN DE VALORES AL HTML
    // Total de Obras
    document.getElementById('kpi-total-obras').innerText = totalObras.toLocaleString('es-AR');
    
    // Inversión Total:
    // 1. Mostrar solo el valor formateado (ej: 10,29) en el h2
    document.getElementById('kpi-monto-total').innerText = montoFormateado; 
    
    // 2. Si existe una unidad, agregar el asterisco y la unidad. Si no, dejar vacío.
    if (unidadMonto) {
        // Agrega el asterisco al valor principal para simular el formato de la imagen (10,29*)
        document.getElementById('kpi-monto-total').innerText += '*'; 
        
        // Muestra el asterisco y la unidad en el elemento separado (* Mil Millones (ARS))
        document.getElementById('kpi-monto-unidad').innerText = `* ${unidadMonto}`;
    } else {
        document.getElementById('kpi-monto-unidad').innerText = ''; 
    }

    // Obras en Ejecución
    document.getElementById('kpi-en-ejecucion').innerText = obrasEnEjecucion.toLocaleString('es-AR'); 
    
    // Obras Finalizadas
    document.getElementById('kpi-obras-finalizadas').innerText = obrasFinalizadas.toLocaleString('es-AR');
}

// --- FUNCIÓN PARA ACTUALIZAR LA TABLA DE DATOS ---
function actualizarTabla(geojsonFiltrado) {
    const tbody = document.getElementById('tabla-obras-body');
    tbody.innerHTML = ''; // Limpiar filas anteriores

    geojsonFiltrado.features.forEach(obra => {
        const row = document.createElement('tr');
        const p = obra.properties;
        // Formato de monto para la tabla (completo en moneda)
        const montoFormateado = (parseFloat(p.monto) || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
        
        // Cálculo del texto de Avance para la tabla
        let avanceTexto;
        if (p.avporr !== null && p.avporr !== undefined && parseFloat(p.avporr) >= 0) {
            avanceTexto = `${Math.min(100, parseFloat(p.avporr)).toFixed(2)}%`;
        } else {
            avanceTexto = 'N/D';
        }

        row.innerHTML = `
            <td>${p.nombre || 'N/A'}</td>
            <td>${p.localidad || 'N/A'}</td>
            <td>${p.tipo || 'N/A'}</td>
            <td>${p.organismo || 'N/A'}</td>
            <td>${montoFormateado}</td>
            <td>${avanceTexto}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// --- FUNCIÓN PARA ACTUALIZAR GRÁFICOS (Chart.js) ---
function actualizarGraficos(geojsonFiltrado) {
    const obras = geojsonFiltrado.features;
    const chartColors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6c757d', '#6f42c1', '#fd7e14'];
    const commonOptions = { 
        responsive: true, 
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom' 
            }
        }
    };
    
    // Destruir instancias anteriores de los gráficos para actualizar sin errores
    if (graficoLocalidades) graficoLocalidades.destroy();
    if (graficoTipos) graficoTipos.destroy();

    // Conteo por Localidad (Gráfico de Barras)
    const conteoLocalidades = obras.reduce((acc, { properties }) => { acc[properties.localidad] = (acc[properties.localidad] || 0) + 1; return acc; }, {});
    graficoLocalidades = new Chart(document.getElementById('proyectosPorLocalidadChart'), {
        type: 'bar',
        data: { 
            labels: Object.keys(conteoLocalidades), 
            datasets: [{ 
                label: 'Nº de Proyectos', 
                data: Object.values(conteoLocalidades), 
                backgroundColor: chartColors 
            }] 
        },
        options: {
            ...commonOptions,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    // Conteo por Tipo (Gráfico de Rosquilla/Dona)
    const conteoTipos = obras.reduce((acc, { properties }) => { acc[properties.tipo] = (acc[properties.tipo] || 0) + 1; return acc; }, {});
    graficoTipos = new Chart(document.getElementById('proyectosPorTipoChart'), {
        type: 'doughnut',
        data: { 
            labels: Object.keys(conteoTipos), 
            datasets: [{ 
                data: Object.values(conteoTipos), 
                backgroundColor: chartColors 
            }] 
        },
        options: commonOptions
    });

}
