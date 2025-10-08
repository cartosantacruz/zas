// 1. Inicialización del mapa
const map = L.map('map').setView([-38.0055, -57.5426], 13);

// 2. Capa base (por ejemplo, OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 3. URL del archivo GeoJSON - ¡MODIFICADA A RAW!
// Esta URL es la correcta para acceder al contenido puro del archivo
const geojsonUrl = 'https://raw.githubusercontent.com/cartosantacruz/zas/main/data/obras.geojson';

// 4. Función para cargar y agregar los datos GeoJSON
async function cargarDatosGeoJSON() {
    try {
        const response = await fetch(geojsonUrl);
        
        // Verifica si la respuesta es exitosa (código 200-299)
        if (!response.ok) {
            throw new Error(`Error al cargar los datos: ${response.statusText}`);
        }

        const data = await response.json();
        
        // Agrega los datos al mapa
        L.geoJSON(data, {
            onEachFeature: function (feature, layer) {
                // Configura el popup para cada punto
                if (feature.properties && feature.properties.Nombre) {
                    layer.bindPopup(`<b>Obra:</b> ${feature.properties.Nombre}<br>
                                     <b>Estado:</b> ${feature.properties.Estado || 'No especificado'}`);
                }
            },
            pointToLayer: function (feature, latlng) {
                // Personaliza el marcador (puedes usar un marcador predeterminado por ahora)
                return L.marker(latlng);
            }
        }).addTo(map);

        console.log("✅ Datos GeoJSON cargados y agregados al mapa.");

    } catch (error) {
        console.error("❌ No se pudieron cargar los datos GeoJSON:", error);
        // Opcional: Mostrar un mensaje de error al usuario en el mapa o la consola
        alert("Error al cargar los datos de obras. Revisa la consola para más detalles.");
    }
}

// 5. Llama a la función para iniciar la carga
cargarDatosGeoJSON();
