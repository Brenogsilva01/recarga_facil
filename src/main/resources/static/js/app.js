/**
 * RECARGA FÁCIL - APPLICATION CONTROLLER (VANILLA JS)
 * Gerencia a navegação SPA de todas as telas (Mapa, Detalhes, Agendamento,
 * Checkout com 25%, Sucesso, Favoritos, Minhas Recargas e Perfil).
 * Integrado com a API REST em Java Spring Boot (via js/api.js).
 */

// Estado Global da Aplicação
const AppState = {
  currentScreen: 'screen-search',
  previousScreen: null,
  selectedWallbox: null,
  activeTypeFilter: 'todos', // 'todos' | 'residencial' | 'comercial'
  favoritesFilter: 'todos',
  selectedAmenities: new Set(), // ['wifi', 'cafe', 'coberto', ...]
  favorites: new Set(['wb-001', 'wb-003']), // IDs favoritados por padrão
  searchQuery: '',
  wallboxesList: [],
  backendOnline: false,
  userLocation: {
    lat: -23.5100,
    lng: -47.4600,
    address: 'Sorocaba - SP'
  },
  userMarker: null,
  booking: {
    wallboxId: 1,
    reservaId: 1,
    date: 'Hoje, 26 Ago',
    selectedStartTime: '08:00',
    timeSlot: '08:00 - 10:00',
    durationHours: 2,
    pricePerHour: 15.00,
    subtotal: 30.00,
    platformFeeRate: 0.25, // 25% de taxa de intermediação
    platformFee: 7.50,
    total: 37.50,
    paymentMethod: 'pix',
    reservationCode: 'RF-84920'
  },
  userBookings: [
    {
      id: "res-01",
      code: "RF-84920",
      wallboxTitle: "Wallbox EcoCharge Campolim",
      wallboxPhoto: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=800&q=80",
      power: "7.4 kW",
      date: "Hoje, 26 Ago",
      time: "14:00 - 16:00 (2h)",
      total: 37.50,
      fee25: 7.50,
      status: "CONCLUIDA",
      address: "Rua Antonio Perez Hernandez, 480 - Casa 34, Campolim",
      accessNotes: "Interfone 34, portão automático. Anfitrião Carlos avisado."
    },
    {
      id: "res-02",
      code: "RF-71044",
      wallboxTitle: "Hub FastCharge Sorocaba Coworking",
      wallboxPhoto: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",
      power: "22 kW",
      date: "22 Ago 2026",
      time: "10:00 - 12:00 (2h)",
      total: 55.00,
      fee25: 11.00,
      status: "CONCLUIDA",
      address: "Av. Eng. Carlos Reinaldo Mendes, 2015 - Vagas EV 01 e 02",
      accessNotes: "Ticket na cancela. Vagas EV no Piso -1."
    }
  ],
  map: null,
  markers: []
};

// Inicialização após carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
  loadSavedFavorites();
  initApp();
});

async function initApp() {
  initTimeStatusBar();
  initAmenitiesFilters();
  initMap();
  bindNavigationEvents();
  bindFilterEvents();
  bindDesktopToggle();

  // Conexão com Back-end Java Spring Boot
  await loadWallboxData();
}

function loadSavedFavorites() {
  try {
    const saved = localStorage.getItem('recarga_facil_favorites');
    if (saved) {
      AppState.favorites = new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.log("Local storage fallback.");
  }
}

function saveFavorites() {
  try {
    localStorage.setItem('recarga_facil_favorites', JSON.stringify(Array.from(AppState.favorites)));
  } catch (e) {}
}

/**
 * RN02: CÁLCULO DE DISTÂNCIAS GEODÉSICAS (LEAFLET OPEN SOURCE)
 * Utiliza L.latLng().distanceTo() para computar com alta precisão geodésica
 * a distância em km entre o condutor do veículo elétrico e cada ponto de recarga.
 * Nesta fase inicial, a busca por raio é filtrada a nível de banco de dados (Spring Boot / SQL Haversine).
 */
function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  if (typeof L !== 'undefined' && L.latLng) {
    const point1 = L.latLng(lat1, lng1);
    const point2 = L.latLng(lat2, lng2);
    return point1.distanceTo(point2) / 1000; // Converte metros para quilômetros
  }
  // Fallback de Haversine matemático caso Leaflet não esteja instanciado
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function updateDistancesFromUserLocation() {
  const list = (AppState.wallboxesList && AppState.wallboxesList.length > 0)
    ? AppState.wallboxesList
    : WALLBOXES_DATA;

  list.forEach(wb => {
    if (wb.lat && wb.lng && AppState.userLocation) {
      const dist = calculateDistanceKm(
        AppState.userLocation.lat,
        AppState.userLocation.lng,
        wb.lat,
        wb.lng
      );
      wb.distanceKm = Number(dist.toFixed(1));
    }
  });
}

/**
 * Carrega pontos de recarga da API Java Spring Boot (com suporte a filtro de raio no banco de dados)
 */
async function loadWallboxData() {
  const isHealthy = await ApiService.checkBackendHealth();
  AppState.backendOnline = isHealthy;
  updateBackendStatusBadge(isHealthy);

  // Consulta pontos no backend (filtrando por raio de proximidade no BD) ou usa dataset local
  AppState.wallboxesList = await ApiService.getWallboxes(
    AppState.userLocation.lat,
    AppState.userLocation.lng,
    15
  );

  if (AppState.wallboxesList.length > 0) {
    AppState.selectedWallbox = AppState.wallboxesList[0];
  }

  updateDistancesFromUserLocation();
  renderMapMarkers();
  renderUserLocationMarker(AppState.userLocation.lat, AppState.userLocation.lng);
}

function updateBackendStatusBadge(isOnline) {
  const badgeEl = document.getElementById('backend-status-indicator');
  if (badgeEl) {
    if (isOnline) {
      badgeEl.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#00D084;margin-right:4px;"></span> Java API Online`;
      badgeEl.style.color = '#047857';
      badgeEl.style.background = '#ECFDF5';
    } else {
      badgeEl.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#F59E0B;margin-right:4px;"></span> Modo Standalone`;
      badgeEl.style.color = '#B45309';
      badgeEl.style.background = '#FEF3C7';
    }
  }
}

/* ==========================================================================
   1. MAPA INTERATIVO E MARCADORES (LEAFLET + OPENSTREETMAP OPEN SOURCE)
   ========================================================================== */
function initMap() {
  const mapElement = document.getElementById('map-container');
  if (!mapElement) return;

  const defaultCenter = [AppState.userLocation.lat, AppState.userLocation.lng];

  try {
    AppState.map = L.map('map-container', {
      zoomControl: false,
      attributionControl: true
    }).setView(defaultCenter, 13);

    // Tiles oficiais OpenSource do OpenStreetMap (100% livres, sem restrição de API Key)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(AppState.map);

    renderUserLocationMarker(AppState.userLocation.lat, AppState.userLocation.lng);
    renderMapMarkers();
  } catch (e) {
    console.warn("Leaflet fallback ativo.", e);
  }
}

function renderUserLocationMarker(lat, lng) {
  if (!AppState.map) return;
  if (AppState.userMarker) {
    AppState.map.removeLayer(AppState.userMarker);
  }

  const userIcon = L.divIcon({
    className: 'leaflet-user-gps-icon',
    html: `
      <div style="position: relative; width: 28px; height: 28px;">
        <div class="pin-pulse" style="background: rgba(0, 102, 204, 0.4);"></div>
        <div style="position: absolute; width: 16px; height: 16px; top: 6px; left: 6px; border-radius: 50%; background: #0066CC; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center;">
          <div style="width: 4px; height: 4px; border-radius: 50%; background: white;"></div>
        </div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  AppState.userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(AppState.map);
}

function handleGpsLocate() {
  showToast("Obtendo localização do veículo...");

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        AppState.userLocation.lat = lat;
        AppState.userLocation.lng = lng;

        if (AppState.map) {
          AppState.map.setView([lat, lng], 14);
          renderUserLocationMarker(lat, lng);
        }

        // RN02: Busca no banco de dados por proximidade
        if (AppState.backendOnline) {
          AppState.wallboxesList = await ApiService.getWallboxes(lat, lng, 15);
        }

        // RN02: Recalcula distâncias de todos os pontos no frontend usando Leaflet
        updateDistancesFromUserLocation();
        renderMapMarkers();
        showToast("Distâncias recalculadas com Leaflet (RN02)");
      },
      (error) => {
        console.warn("Geolocalização não autorizada, centralizando em Sorocaba/SP:", error);
        if (AppState.map) {
          AppState.map.setView([AppState.userLocation.lat, AppState.userLocation.lng], 13);
          renderUserLocationMarker(AppState.userLocation.lat, AppState.userLocation.lng);
        }
        updateDistancesFromUserLocation();
        renderMapMarkers();
        showToast("Mapa centralizado em Sorocaba - SP");
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  } else {
    if (AppState.map) {
      AppState.map.setView([AppState.userLocation.lat, AppState.userLocation.lng], 13);
      renderUserLocationMarker(AppState.userLocation.lat, AppState.userLocation.lng);
    }
    updateDistancesFromUserLocation();
    renderMapMarkers();
    showToast("Mapa centralizado em Sorocaba - SP");
  }
}

function renderMapMarkers() {
  if (!AppState.map) return;

  AppState.markers.forEach(m => AppState.map.removeLayer(m));
  AppState.markers = [];

  const filteredWallboxes = getFilteredWallboxes();
  updateResultsCount(filteredWallboxes.length);

  filteredWallboxes.forEach(wb => {
    const isCommercial = wb.type === 'comercial';
    const pinClass = isCommercial ? 'commercial-pin' : '';
    const iconName = isCommercial ? 'ri-building-2-fill' : 'ri-home-4-fill';

    const customIcon = L.divIcon({
      className: 'leaflet-custom-div-icon',
      html: `
        <div class="custom-map-pin ${pinClass}" onclick="handleMarkerClick('${wb.id}')">
          <div class="pin-pulse"></div>
          <i class="${iconName}"></i>
          <span>R$ ${wb.pricePerHour.toFixed(0)}/h</span>
        </div>
      `,
      iconSize: [80, 30],
      iconAnchor: [40, 15]
    });

    const marker = L.marker([wb.lat, wb.lng], { icon: customIcon }).addTo(AppState.map);
    AppState.markers.push(marker);
  });
}

function handleMarkerClick(wallboxId) {
  const wallbox = (AppState.wallboxesList && AppState.wallboxesList.find(w => w.id === wallboxId)) 
    || WALLBOXES_DATA.find(w => w.id === wallboxId);
  if (!wallbox) return;

  AppState.selectedWallbox = wallbox;
  showBottomSheetPreview(wallbox);
}

function showBottomSheetPreview(wallbox) {
  const bottomSheet = document.getElementById('map-bottom-sheet');
  if (!bottomSheet) return;

  const isRes = wallbox.type === 'residencial';
  const typeBadge = isRes 
    ? `<span class="badge badge-residential"><i class="ri-home-4-line"></i> Residencial</span>` 
    : `<span class="badge badge-commercial"><i class="ri-building-2-line"></i> Comercial</span>`;

  bottomSheet.innerHTML = `
    <div class="preview-card-content">
      <img src="${wallbox.photo}" alt="${wallbox.title}" class="preview-thumbnail">
      <div class="preview-details">
        <div>
          <div class="d-flex justify-between align-center mb-1">
            ${typeBadge}
            <span class="badge badge-power"><i class="ri-flashlight-line"></i> ${wallbox.power}</span>
          </div>
          <h3 class="preview-title">${wallbox.title}</h3>
          <p class="text-muted" style="font-size: 12px;"><i class="ri-map-pin-2-line"></i> ${wallbox.distanceKm} km • ${wallbox.neighborhood}</p>
        </div>
        <div class="d-flex justify-between align-center mt-2">
          <div class="preview-price">R$ ${wallbox.pricePerHour.toFixed(2).replace('.', ',')}<small>/h</small></div>
          <button class="btn btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="navigateTo('screen-details')">
            Ver Detalhes <i class="ri-arrow-right-line"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  bottomSheet.classList.add('show');
}

/* ==========================================================================
   2. FILTROS DE COMODIDADES E TIPO
   ========================================================================== */
function initAmenitiesFilters() {
  const container = document.getElementById('amenities-filter-container');
  if (!container) return;

  container.innerHTML = Object.entries(AMENITY_CONFIG).map(([key, config]) => `
    <button class="amenity-chip" data-amenity="${key}" onclick="toggleAmenityFilter('${key}', this)">
      <i class="${config.icon}"></i> ${config.label}
    </button>
  `).join('');
}

function toggleAmenityFilter(amenityKey, element) {
  if (AppState.selectedAmenities.has(amenityKey)) {
    AppState.selectedAmenities.delete(amenityKey);
    element.classList.remove('selected');
  } else {
    AppState.selectedAmenities.add(amenityKey);
    element.classList.add('selected');
  }

  renderMapMarkers();
  showToast(AppState.selectedAmenities.size > 0 
    ? `Filtro de comodidades atualizado (${AppState.selectedAmenities.size} ativas)`
    : "Mostrando todos os pontos"
  );
}

function getFilteredWallboxes() {
  const sourceList = (AppState.wallboxesList && AppState.wallboxesList.length > 0) 
    ? AppState.wallboxesList 
    : WALLBOXES_DATA;

  return sourceList.filter(wb => {
    if (AppState.activeTypeFilter !== 'todos' && wb.type !== AppState.activeTypeFilter) {
      return false;
    }

    if (AppState.selectedAmenities.size > 0) {
      for (const amenity of AppState.selectedAmenities) {
        if (!wb.amenities || !wb.amenities.includes(amenity)) {
          return false;
        }
      }
    }

    if (AppState.searchQuery.trim() !== '') {
      const q = AppState.searchQuery.toLowerCase();
      const matchTitle = wb.title.toLowerCase().includes(q);
      const matchNeigh = wb.neighborhood ? wb.neighborhood.toLowerCase().includes(q) : false;
      const matchCity = wb.city ? wb.city.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchNeigh && !matchCity) return false;
    }

    return true;
  });
}

function updateResultsCount(count) {
  const counterEl = document.getElementById('results-counter');
  if (counterEl) {
    counterEl.innerHTML = `<i class="ri-charging-pile-2-fill"></i> ${count} wallbox${count === 1 ? '' : 'es'} disponíve${count === 1 ? 'l' : 'is'}`;
  }
}

/* ==========================================================================
   3. NAVEGAÇÃO ENTRE TODAS AS TELAS (SPA CONTROLLER)
   ========================================================================== */
function navigateTo(targetScreenId) {
  const targetScreen = document.getElementById(targetScreenId);
  if (!targetScreen || targetScreenId === AppState.currentScreen) return;

  AppState.previousScreen = AppState.currentScreen;
  AppState.currentScreen = targetScreenId;

  // Renderiza telas dinâmicas
  if (targetScreenId === 'screen-details') renderScreenDetails();
  if (targetScreenId === 'screen-booking') renderScreenBooking();
  if (targetScreenId === 'screen-checkout') renderScreenCheckout();
  if (targetScreenId === 'screen-success') renderScreenSuccess();
  if (targetScreenId === 'screen-favorites') renderScreenFavorites();
  if (targetScreenId === 'screen-bookings-list') renderScreenBookingsList();
  if (targetScreenId === 'screen-profile') renderScreenProfile();

  document.querySelectorAll('.app-screen').forEach(screen => {
    screen.classList.remove('active');
  });
  targetScreen.classList.add('active');

  // Atualiza active do bottom navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-target') === targetScreenId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Oculta bottom-nav apenas em telas de fluxo linear (detalhes, agendamento, checkout)
  const bottomNav = document.getElementById('bottom-nav-bar');
  if (bottomNav) {
    const isMainTab = ['screen-search', 'screen-favorites', 'screen-bookings-list', 'screen-profile'].includes(targetScreenId);
    bottomNav.style.display = isMainTab ? 'flex' : 'none';
  }

  targetScreen.scrollTop = 0;
}

function goBack() {
  if (AppState.currentScreen === 'screen-details') {
    navigateTo('screen-search');
  } else if (AppState.currentScreen === 'screen-booking') {
    navigateTo('screen-details');
  } else if (AppState.currentScreen === 'screen-checkout') {
    navigateTo('screen-booking');
  } else if (AppState.currentScreen === 'screen-success') {
    navigateTo('screen-bookings-list');
  } else {
    navigateTo('screen-search');
  }
}

/* ==========================================================================
   4. TELA DE FAVORITOS (SCREEN FAVORITES)
   ========================================================================== */
function toggleFavorite(wallboxId, event) {
  if (event) event.stopPropagation();

  if (AppState.favorites.has(wallboxId)) {
    AppState.favorites.delete(wallboxId);
    showToast("Removido dos favoritos");
  } else {
    AppState.favorites.add(wallboxId);
    showToast("Adicionado aos favoritos!");
  }

  saveFavorites();

  // Re-renderiza a tela de favoritos se estiver nela
  if (AppState.currentScreen === 'screen-favorites') {
    renderScreenFavorites();
  }
  // Re-renderiza detalhes se estiver nela
  if (AppState.currentScreen === 'screen-details') {
    renderScreenDetails();
  }
}

function renderScreenFavorites() {
  const container = document.getElementById('favorites-content-placeholder');
  if (!container) return;

  const allWallboxes = (AppState.wallboxesList && AppState.wallboxesList.length > 0) 
    ? AppState.wallboxesList 
    : WALLBOXES_DATA;

  // Filtra as wallboxes favoritadas
  const favList = allWallboxes.filter(wb => AppState.favorites.has(wb.id));

  // Aplica filtro por tipo na tela de favoritos
  const filteredFavs = favList.filter(wb => {
    if (AppState.favoritesFilter !== 'todos' && wb.type !== AppState.favoritesFilter) {
      return false;
    }
    return true;
  });

  const cardsHtml = filteredFavs.map(wb => {
    const isRes = wb.type === 'residencial';
    const typeBadge = isRes 
      ? `<span class="badge badge-residential"><i class="ri-home-4-line"></i> Residencial</span>` 
      : `<span class="badge badge-commercial"><i class="ri-building-2-line"></i> Comercial</span>`;

    const amenitiesIcons = (wb.amenities || []).slice(0, 3).map(am => {
      const cfg = AMENITY_CONFIG[am];
      return cfg ? `<span class="badge" style="background:#F1F5F9;color:#475569;"><i class="${cfg.icon}"></i> ${cfg.label.split(' ')[0]}</span>` : '';
    }).join(' ');

    return `
      <div class="favorite-card" onclick="openFavoriteDetails('${wb.id}')">
        <div class="favorite-card-media">
          <img src="${wb.photo}" alt="${wb.title}">
          <button class="btn-favorite-remove" onclick="toggleFavorite('${wb.id}', event)" title="Remover dos Favoritos">
            <i class="ri-heart-3-fill"></i>
          </button>
        </div>
        <div class="favorite-card-body">
          <div class="d-flex justify-between align-center">
            ${typeBadge}
            <span class="badge badge-power"><i class="ri-flashlight-line"></i> ${wb.power}</span>
          </div>
          <h3 style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-top: 2px;">${wb.title}</h3>
          <p style="font-size: 12px; color: var(--text-muted);"><i class="ri-map-pin-2-line"></i> ${wb.distanceKm} km • ${wb.neighborhood || wb.city}</p>
          
          <div class="d-flex gap-1 mt-1" style="flex-wrap: wrap;">
            ${amenitiesIcons}
          </div>

          <div class="d-flex justify-between align-center mt-2" style="border-top: 1px solid var(--border-light); padding-top: 8px;">
            <div style="font-size: 16px; font-weight: 800; color: var(--secondary);">
              R$ ${wb.pricePerHour.toFixed(2).replace('.', ',')}<small style="font-size: 11px; font-weight: 500; color: var(--text-muted);">/h</small>
            </div>
            <button class="btn btn-primary" style="padding: 6px 14px; font-size: 12px;" onclick="quickBookFavorite('${wb.id}', event)">
              <i class="ri-calendar-check-line"></i> Agendar
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="screen-scroll-body" style="padding: 16px 16px calc(var(--bottom-nav-height) + 20px) 16px;">
      <div class="favorites-header">
        <h1>Meus Favoritos</h1>
        <p>${favList.length} ponto${favList.length === 1 ? '' : 's'} de recarga salvo${favList.length === 1 ? '' : 's'}</p>
      </div>

      <!-- Filtros de Tipo nos Favoritos -->
      <div class="filter-pills-row mb-3">
        <button class="filter-chip ${AppState.favoritesFilter === 'todos' ? 'active' : ''}" onclick="setFavoritesFilter('todos')">
          Todos (${favList.length})
        </button>
        <button class="filter-chip ${AppState.favoritesFilter === 'residencial' ? 'active' : ''}" onclick="setFavoritesFilter('residencial')">
          Residenciais
        </button>
        <button class="filter-chip ${AppState.favoritesFilter === 'comercial' ? 'active' : ''}" onclick="setFavoritesFilter('comercial')">
          Comerciais
        </button>
      </div>

      <!-- Lista de Cards ou Estado Vazio -->
      ${favList.length === 0 ? `
        <div class="empty-state-box">
          <div class="empty-state-icon"><i class="ri-heart-3-line"></i></div>
          <h3 style="font-size: 16px; font-weight: 700;">Nenhum favorito salvo ainda</h3>
          <p style="font-size: 13px; color: var(--text-muted); max-width: 260px;">
            Toque no ícone de coração nos pontos do mapa para salvá-los aqui e agendar recargas com rapidez.
          </p>
          <button class="btn btn-primary mt-2" onclick="navigateTo('screen-search')">
            <i class="ri-map-pin-2-line"></i> Explorar no Mapa
          </button>
        </div>
      ` : cardsHtml}
    </div>
  `;
}

function setFavoritesFilter(filterType) {
  AppState.favoritesFilter = filterType;
  renderScreenFavorites();
}

function openFavoriteDetails(wbId) {
  const allWallboxes = (AppState.wallboxesList && AppState.wallboxesList.length > 0) ? AppState.wallboxesList : WALLBOXES_DATA;
  const wb = allWallboxes.find(w => w.id === wbId);
  if (wb) {
    AppState.selectedWallbox = wb;
    navigateTo('screen-details');
  }
}

function quickBookFavorite(wbId, event) {
  if (event) event.stopPropagation();
  openFavoriteDetails(wbId);
  navigateTo('screen-booking');
}

/* ==========================================================================
   5. TELA DE MINHAS RECARGAS / HISTÓRICO (SCREEN BOOKINGS LIST)
   ========================================================================== */
function renderScreenBookingsList() {
  const container = document.getElementById('bookings-list-content-placeholder');
  if (!container) return;

  const bookingsHtml = AppState.userBookings.map(item => `
    <div class="booking-item-card">
      <div class="d-flex justify-between align-center mb-2">
        <span class="booking-status-tag completed"><i class="ri-checkbox-circle-fill"></i> ${item.status}</span>
        <span style="font-family: monospace; font-size: 12px; font-weight: 700; color: var(--secondary);">${item.code}</span>
      </div>

      <div class="d-flex gap-3 align-center mb-3">
        <img src="${item.wallboxPhoto}" style="width: 54px; height: 54px; border-radius: var(--radius-md); object-fit: cover;">
        <div>
          <h4 style="font-size: 14px; font-weight: 700; color: var(--text-main);">${item.wallboxTitle}</h4>
          <p style="font-size: 12px; color: var(--text-muted);">${item.date} • ${item.time}</p>
        </div>
      </div>

      <div class="access-instructions-box mb-2" style="font-size: 11px;">
        <strong><i class="ri-lock-unlock-line text-primary"></i> Endereço Liberado:</strong><br>
        ${item.address}<br>
        <span style="color: var(--text-muted);">${item.accessNotes}</span>
      </div>

      <div class="d-flex justify-between align-center pt-2" style="border-top: 1px solid var(--border-light);">
        <div>
          <span style="font-size: 11px; color: var(--text-muted);">Total Pago (Taxa 25% inclusa)</span>
          <div style="font-size: 15px; font-weight: 800; color: var(--secondary);">R$ ${item.total.toFixed(2).replace('.', ',')}</div>
        </div>
        <button class="btn btn-outline-primary" style="padding: 6px 12px; font-size: 12px;" onclick="showToast('Comprovante enviado para seu e-mail')">
          <i class="ri-receipt-line"></i> Comprovante
        </button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="screen-scroll-body" style="padding: 16px 16px calc(var(--bottom-nav-height) + 20px) 16px;">
      <div class="favorites-header">
        <h1>Minhas Recargas</h1>
        <p>Histórico e sessões agendadas</p>
      </div>

      ${bookingsHtml}
    </div>
  `;
}

/* ==========================================================================
   6. TELA DE PERFIL (SCREEN PROFILE)
   ========================================================================== */
function renderScreenProfile() {
  const container = document.getElementById('profile-content-placeholder');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-scroll-body" style="padding: 16px 16px calc(var(--bottom-nav-height) + 20px) 16px;">
      <!-- Card do Usuário -->
      <div class="profile-hero-card">
        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&h=160&q=80" alt="Avatar" class="profile-avatar-large">
        <div>
          <h2 style="font-size: 17px; font-weight: 800;">Motorista Demo EV</h2>
          <p style="font-size: 12px; color: #94A3B8;">motorista@email.com</p>
          <span class="badge badge-verified mt-1" style="background: rgba(0, 208, 132, 0.2); color: #00D084;">
            <i class="ri-shield-check-fill"></i> Motorista Verificado
          </span>
        </div>
      </div>

      <!-- Veículo Elétrico Cadastrado -->
      <div class="card mb-3">
        <div class="d-flex justify-between align-center mb-2">
          <span style="font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Meu Veículo Elétrico</span>
          <span class="badge badge-power"><i class="ri-plug-line"></i> Tipo 2 / CCS2</span>
        </div>
        <div class="d-flex gap-3 align-center">
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: #ECFDF5; display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--secondary);">
            <i class="ri-car-line"></i>
          </div>
          <div>
            <h4 style="font-size: 14px; font-weight: 800;">BYD Dolphin GS 2024</h4>
            <p style="font-size: 12px; color: var(--text-muted);">Placa: BRA2E19 • Bateria 44.9 kWh</p>
          </div>
        </div>
      </div>

      <!-- Dashboard de Impacto Sustentável -->
      <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">Seu Impacto Sustentável</h3>
      <div class="impact-dashboard-grid">
        <div class="impact-metric-box">
          <i class="ri-leaf-line" style="color: var(--primary); font-size: 18px;"></i>
          <div class="metric-val">148.5 kg</div>
          <div class="metric-label">CO₂ Evitado</div>
        </div>
        <div class="impact-metric-box">
          <i class="ri-flashlight-line" style="color: #F59E0B; font-size: 18px;"></i>
          <div class="metric-val">210 kWh</div>
          <div class="metric-label">Energia Limpa</div>
        </div>
        <div class="impact-metric-box">
          <i class="ri-charging-pile-line" style="color: #3B82F6; font-size: 18px;"></i>
          <div class="metric-val">5</div>
          <div class="metric-label">Sessões</div>
        </div>
      </div>

      <!-- Menu de Opções -->
      <div class="profile-menu-list mb-3">
        <div class="profile-menu-item" onclick="showToast('Cartão Mastercard final 8821 ativo')">
          <div class="menu-left">
            <div class="menu-icon"><i class="ri-bank-card-line"></i></div>
            <span>Formas de Pagamento (Pix / Cartão)</span>
          </div>
          <i class="ri-arrow-right-s-line text-muted"></i>
        </div>
        <div class="profile-menu-item" onclick="showToast('Cadastre sua Wallbox e ganhe renda extra!')">
          <div class="menu-left">
            <div class="menu-icon" style="color: #F59E0B; background: #FEF3C7;"><i class="ri-home-wifi-line"></i></div>
            <span>Tornar-se um Anfitrião (Host)</span>
          </div>
          <i class="ri-arrow-right-s-line text-muted"></i>
        </div>
        <div class="profile-menu-item" onclick="showToast('Notificações push ativadas')">
          <div class="menu-left">
            <div class="menu-icon"><i class="ri-notification-3-line"></i></div>
            <span>Notificações e Avisos</span>
          </div>
          <i class="ri-arrow-right-s-line text-muted"></i>
        </div>
        <div class="profile-menu-item" onclick="showToast('Suporte Recarga Fácil: suporte@recargafacil.com')">
          <div class="menu-left">
            <div class="menu-icon"><i class="ri-customer-service-2-line"></i></div>
            <span>Ajuda & Suporte UPX 4</span>
          </div>
          <i class="ri-arrow-right-s-line text-muted"></i>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   7. RENDERIZAÇÃO DAS TELAS DE DETALHES, AGENDAMENTO E CHECKOUT
   ========================================================================== */

// Tela 2: Detalhes da Wallbox
function renderScreenDetails() {
  const wb = AppState.selectedWallbox || WALLBOXES_DATA[0];
  const container = document.getElementById('details-content-placeholder');
  if (!container) return;

  const isRes = wb.type === 'residencial';
  const typeBadge = isRes 
    ? `<span class="badge badge-residential"><i class="ri-home-4-line"></i> Residencial</span>` 
    : `<span class="badge badge-commercial"><i class="ri-building-2-line"></i> Comercial</span>`;

  const superHostBadge = wb.isSuperHost 
    ? `<span class="badge badge-superhost"><i class="ri-medal-fill"></i> Super Anfitrião</span>` 
    : '';

  const isFav = AppState.favorites.has(wb.id);

  const amenitiesHtml = (wb.amenities || []).map(amKey => {
    const config = AMENITY_CONFIG[amKey];
    if (!config) return '';
    return `
      <div class="amenity-feature-item">
        <i class="${config.icon}"></i>
        <span>${config.label}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="screen-scroll-body" style="padding-bottom: 85px;">
      <!-- Hero Image -->
      <div class="details-hero">
        <img src="${wb.photo}" alt="${wb.title}" class="details-hero-img">
        <div class="hero-overlay-actions">
          <button class="btn-icon" onclick="goBack()"><i class="ri-arrow-left-line"></i></button>
          <button class="btn-icon" onclick="toggleFavorite('${wb.id}')" title="Favoritar">
            <i class="${isFav ? 'ri-heart-3-fill' : 'ri-heart-3-line'}" style="${isFav ? 'color: #EF4444;' : ''}"></i>
          </button>
        </div>
        <div class="hero-gradient"></div>
        <div class="hero-badge-pill">
          ${typeBadge}
        </div>
      </div>

      <!-- Conteúdo dos Detalhes -->
      <div class="details-content-body">
        <div class="details-title-row">
          <h1>${wb.title}</h1>
          <div class="location-text">
            <i class="ri-map-pin-2-fill text-primary"></i> ${wb.maskedAddress}
          </div>
        </div>

        <!-- Grid de Especificações Técnicas -->
        <div class="specs-grid">
          <div class="spec-box">
            <i class="ri-flashlight-fill"></i>
            <span class="spec-label">Potência</span>
            <span class="spec-value">${wb.power}</span>
          </div>
          <div class="spec-box">
            <i class="ri-plug-2-fill"></i>
            <span class="spec-label">Plugue</span>
            <span class="spec-value">${wb.plugType ? wb.plugType.split(' ')[0] : 'Tipo 2'}</span>
          </div>
          <div class="spec-box">
            <i class="ri-money-dollar-circle-fill"></i>
            <span class="spec-label">Preço/Hora</span>
            <span class="spec-value text-secondary">R$ ${wb.pricePerHour.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        <!-- Card do Anfitrião -->
        <div class="host-card">
          <img src="${wb.hostAvatar}" alt="${wb.hostName}" class="host-avatar">
          <div class="host-meta">
            <div class="host-name">${wb.hostName}</div>
            <div class="host-badge-line">
              <span style="color: var(--accent-gold); font-weight: 700;">★ ${wb.hostRating ? wb.hostRating.toFixed(2) : '4.95'}</span>
              <span>(${wb.totalReviews || 24} avaliações)</span>
              ${superHostBadge}
            </div>
          </div>
        </div>

        <!-- Descrição do Espaço -->
        <div class="card">
          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Sobre este ponto</h3>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">${wb.description}</p>
        </div>

        <!-- Comodidades Oferecidas -->
        <div class="amenities-section">
          <h3>Comodidades disponíveis</h3>
          <div class="amenities-list-grid">
            ${amenitiesHtml}
          </div>
        </div>

        <!-- Regra de Segurança: Endereço Mascarado -->
        <div class="security-alert-box">
          <i class="ri-shield-keyhole-line"></i>
          <div class="alert-text">
            <strong>Privacidade e Segurança do Anfitrião:</strong><br>
            O número exato da residência, código de portão e interfone serão revelados imediatamente após a confirmação do pagamento.
          </div>
        </div>
      </div>
    </div>

    <!-- Barra Fixa Inferior de Agendamento (Sempre Ancorada no Rodapé) -->
    <div class="sticky-bottom-action-bar">
      <div class="action-price-preview">
        <div class="price-amount">R$ ${wb.pricePerHour.toFixed(2).replace('.', ',')}<small style="font-size: 13px; font-weight: 500; color: var(--text-muted);">/hora</small></div>
        <div class="price-label">Cancelamento grátis até 1h antes</div>
      </div>
      <button class="btn btn-primary" onclick="navigateTo('screen-booking')">
        <i class="ri-calendar-check-line"></i> Agendar Recarga
      </button>
    </div>
  `;
}

// Funções auxiliares para cálculo dinâmico de janelas de horário
function getWallboxStartTimes(wb) {
  if (wb && wb.availableStartTimes && wb.availableStartTimes.length > 0) {
    return wb.availableStartTimes;
  }
  if (wb && wb.availableSlots && wb.availableSlots.length > 0) {
    return wb.availableSlots.map(slot => {
      // Extrai o horário inicial da string (ex: "08:00 - 10:00" -> "08:00")
      return slot.split('-')[0].trim();
    });
  }
  return ["08:00", "10:00", "13:00", "15:00", "18:00"];
}

function formatSlotRange(startTimeStr, durationHours) {
  if (!startTimeStr) startTimeStr = "08:00";
  const parts = startTimeStr.split(':');
  const startH = parseInt(parts[0], 10) || 0;
  const startM = parseInt(parts[1] || '0', 10) || 0;
  
  const endH = startH + durationHours;
  const startFormatted = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
  const endFormatted = `${String(endH % 24).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
  
  return `${startFormatted} - ${endFormatted}`;
}

function renderTimeSlots() {
  const wb = AppState.selectedWallbox || WALLBOXES_DATA[0];
  const gridContainer = document.getElementById('booking-time-slots-grid');
  if (!gridContainer) return;

  const duration = AppState.booking.durationHours || 2;
  const startTimes = getWallboxStartTimes(wb);

  // Mantém ou inicializa o horário de início selecionado
  let currentStart = AppState.booking.selectedStartTime;
  if (!currentStart && AppState.booking.timeSlot) {
    currentStart = AppState.booking.timeSlot.split('-')[0].trim();
  }
  if (!currentStart || !startTimes.includes(currentStart)) {
    currentStart = startTimes[0] || "08:00";
  }

  AppState.booking.selectedStartTime = currentStart;
  AppState.booking.timeSlot = formatSlotRange(currentStart, duration);

  gridContainer.innerHTML = startTimes.map((startTime) => {
    const slotLabel = formatSlotRange(startTime, duration);
    const isSelected = startTime === currentStart;
    return `
      <button class="time-slot-btn ${isSelected ? 'selected' : ''}" onclick="selectTimeSlot('${slotLabel}', '${startTime}', this)">
        <i class="ri-time-line"></i> ${slotLabel}
      </button>
    `;
  }).join('');
}

// Tela 3: Agendamento de Horário
function renderScreenBooking() {
  const wb = AppState.selectedWallbox || WALLBOXES_DATA[0];
  const container = document.getElementById('booking-content-placeholder');
  if (!container) return;

  AppState.booking.wallboxId = wb.backendId || 1;
  AppState.booking.pricePerHour = wb.pricePerHour;
  if (!AppState.booking.durationHours) {
    AppState.booking.durationHours = 2;
  }
  updateBookingCalculations();

  container.innerHTML = `
    <div class="screen-header-nav">
      <button class="btn-icon" onclick="goBack()"><i class="ri-arrow-left-line"></i></button>
      <span class="header-title">Agendar Sessão</span>
      <div style="width: 40px;"></div>
    </div>

    <div class="screen-scroll-body" style="padding: 16px 16px 95px 16px;">
      <!-- Resumo do Ponto Selecionado -->
      <div class="card mb-3 d-flex gap-3 align-center">
        <img src="${wb.photo}" style="width: 60px; height: 60px; border-radius: var(--radius-md); object-fit: cover;">
        <div>
          <h4 style="font-size: 14px; font-weight: 700;">${wb.title}</h4>
          <div style="font-size: 12px; color: var(--text-muted);">${wb.power} • R$ ${wb.pricePerHour.toFixed(2).replace('.', ',')}/h</div>
        </div>
      </div>

      <!-- Seletor de Data -->
      <div class="booking-section-card">
        <div class="section-label"><i class="ri-calendar-event-line text-primary"></i> 1. Escolha a Data</div>
        <div class="date-selector-row">
          <div class="date-pill selected" onclick="selectBookingDate('Hoje, 26 Ago', this)">
            <div class="day-name">Hoje</div>
            <div class="day-num">26 Ago</div>
          </div>
          <div class="date-pill" onclick="selectBookingDate('Amanhã, 27 Ago', this)">
            <div class="day-name">Amanhã</div>
            <div class="day-num">27 Ago</div>
          </div>
          <div class="date-pill" onclick="selectBookingDate('Sexta, 28 Ago', this)">
            <div class="day-name">Sexta</div>
            <div class="day-num">28 Ago</div>
          </div>
        </div>
      </div>

      <!-- Duração da Recarga -->
      <div class="booking-section-card">
        <div class="section-label"><i class="ri-time-line text-primary"></i> 2. Tempo de Recarga Desejado</div>
        <div class="duration-selector-row">
          <div class="duration-chip ${AppState.booking.durationHours === 1 ? 'selected' : ''}" onclick="selectBookingDuration(1, this)">1 Hora</div>
          <div class="duration-chip ${AppState.booking.durationHours === 2 ? 'selected' : ''}" onclick="selectBookingDuration(2, this)">2 Horas</div>
          <div class="duration-chip ${AppState.booking.durationHours === 3 ? 'selected' : ''}" onclick="selectBookingDuration(3, this)">3 Horas</div>
          <div class="duration-chip ${AppState.booking.durationHours === 4 ? 'selected' : ''}" onclick="selectBookingDuration(4, this)">4 Horas</div>
        </div>
      </div>

      <!-- Grade de Janelas de Horário -->
      <div class="booking-section-card">
        <div class="section-label"><i class="ri-sun-cloudy-line text-primary"></i> 3. Selecione o Horário de Chegada</div>
        <div class="time-slots-grid" id="booking-time-slots-grid">
          <!-- Gerado dinamicamente com base nas horas selecionadas -->
        </div>
      </div>

      <!-- Estimativa em Tempo Real -->
      <div class="card" style="background: var(--primary-light); border-color: var(--primary);">
        <div class="d-flex justify-between align-center">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--secondary); text-transform: uppercase;">Subtotal da Sessão</div>
            <div id="booking-subtotal-preview" style="font-size: 18px; font-weight: 800; color: var(--secondary);">
              R$ ${AppState.booking.subtotal.toFixed(2).replace('.', ',')}
            </div>
          </div>
          <div style="text-align: right; font-size: 12px; color: var(--text-muted);">
            <span id="booking-hours-preview">${AppState.booking.durationHours}h</span> de recarga a ${wb.power}
          </div>
        </div>
      </div>
    </div>

    <!-- Barra Fixa Inferior de Checkout (Sempre Ancorada no Rodapé) -->
    <div class="sticky-bottom-action-bar">
      <div class="action-price-preview">
        <div id="booking-action-total" class="price-amount">R$ ${AppState.booking.total.toFixed(2).replace('.', ',')}</div>
        <div class="price-label">Inclui taxa de 25% da plataforma</div>
      </div>
      <button class="btn btn-primary" onclick="handleConfirmBooking()">
        Ir para Pagamento <i class="ri-arrow-right-line"></i>
      </button>
    </div>
  `;

  renderTimeSlots();
}

async function handleConfirmBooking() {
  const reservaResult = await ApiService.createReserva(AppState.booking);
  if (reservaResult && reservaResult.id) {
    AppState.booking.reservaId = reservaResult.id;
  }
  navigateTo('screen-checkout');
}

function selectBookingDate(dateText, element) {
  AppState.booking.date = dateText;
  document.querySelectorAll('.date-pill').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');
}

function selectBookingDuration(hours, element) {
  AppState.booking.durationHours = hours;
  document.querySelectorAll('.duration-chip').forEach(el => el.classList.remove('selected'));
  if (element) {
    element.classList.add('selected');
  }
  updateBookingCalculations();
  renderTimeSlots();
}

function selectTimeSlot(slotText, startTime, element) {
  AppState.booking.timeSlot = slotText;
  if (startTime) {
    AppState.booking.selectedStartTime = startTime;
  } else {
    AppState.booking.selectedStartTime = slotText.split('-')[0].trim();
  }
  document.querySelectorAll('.time-slot-btn').forEach(el => el.classList.remove('selected'));
  if (element) {
    element.classList.add('selected');
  }
}

function updateBookingCalculations() {
  const subtotal = AppState.booking.pricePerHour * AppState.booking.durationHours;
  const fee = subtotal * AppState.booking.platformFeeRate;
  const total = subtotal + fee;

  AppState.booking.subtotal = subtotal;
  AppState.booking.platformFee = fee;
  AppState.booking.total = total;

  const subtotalEl = document.getElementById('booking-subtotal-preview');
  const actionTotalEl = document.getElementById('booking-action-total');
  const hoursPreviewEl = document.getElementById('booking-hours-preview');

  if (subtotalEl) subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
  if (actionTotalEl) actionTotalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
  if (hoursPreviewEl) hoursPreviewEl.textContent = `${AppState.booking.durationHours}h`;
}

// Tela 4: Pagamento e Checkout (Com Taxa de 25%)
function renderScreenCheckout() {
  const wb = AppState.selectedWallbox || WALLBOXES_DATA[0];
  const container = document.getElementById('checkout-content-placeholder');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-header-nav">
      <button class="btn-icon" onclick="goBack()"><i class="ri-arrow-left-line"></i></button>
      <span class="header-title">Pagamento & Checkout</span>
      <div style="width: 40px;"></div>
    </div>

    <div class="screen-scroll-body" style="padding: 16px 16px 95px 16px;">
      <!-- Resumo da Reserva -->
      <div class="checkout-summary-card">
        <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 10px;">Resumo do Agendamento</h3>
        <div class="receipt-row">
          <span>Ponto de Recarga:</span>
          <strong class="text-main">${wb.title}</strong>
        </div>
        <div class="receipt-row">
          <span>Data e Horário:</span>
          <span>${AppState.booking.date} • ${AppState.booking.timeSlot}</span>
        </div>
        <div class="receipt-row">
          <span>Duração da sessão:</span>
          <span>${AppState.booking.durationHours} horas (${wb.power})</span>
        </div>

        <div class="receipt-divider"></div>

        <!-- Discriminação de Valores com Taxa de 25% -->
        <div class="receipt-row">
          <span>Subtotal (${AppState.booking.durationHours}h × R$ ${wb.pricePerHour.toFixed(2).replace('.', ',')}):</span>
          <span>R$ ${AppState.booking.subtotal.toFixed(2).replace('.', ',')}</span>
        </div>
        
        <div class="receipt-row highlight-fee">
          <span><i class="ri-shield-check-line"></i> Taxa da Plataforma (25%):</span>
          <span>+ R$ ${AppState.booking.platformFee.toFixed(2).replace('.', ',')}</span>
        </div>

        <div class="receipt-divider"></div>

        <div class="receipt-total">
          <span>Total a pagar:</span>
          <span class="total-amount">R$ ${AppState.booking.total.toFixed(2).replace('.', ',')}</span>
        </div>
      </div>

      <!-- Seletor de Forma de Pagamento -->
      <div class="payment-tabs">
        <button class="payment-tab-btn ${AppState.booking.paymentMethod === 'pix' ? 'active' : ''}" onclick="switchPaymentTab('pix')">
          <i class="ri-qr-code-line"></i> Pix Instantâneo
        </button>
        <button class="payment-tab-btn ${AppState.booking.paymentMethod === 'card' ? 'active' : ''}" onclick="switchPaymentTab('card')">
          <i class="ri-bank-card-line"></i> Cartão de Crédito
        </button>
      </div>

      <!-- Conteúdo Pix -->
      <div id="pix-payment-box" class="pix-content-box" style="${AppState.booking.paymentMethod === 'pix' ? '' : 'display: none;'}">
        <div class="badge badge-verified"><i class="ri-flashlight-line"></i> Aprovação Imediata</div>
        
        <div class="qr-code-wrapper">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=00020126580014BR.GOV.BCB.PIX0136recargafacil-upx4-demo-checkout5204000053039865405${AppState.booking.total.toFixed(2)}5802BR" class="qr-code-img" alt="QR Code Pix">
        </div>

        <p style="font-size: 12px; color: var(--text-muted);">Escaneie o QR Code no app do seu banco ou use o Copia e Cola:</p>

        <div class="pix-copia-cola-box">
          <input type="text" readonly value="00020126580014BR.GOV.BCB.PIX0136recargafacil-upx4-demo-checkout5204000053039865405${AppState.booking.total.toFixed(2)}5802BR" class="pix-input" id="pix-copy-field">
          <button class="btn-copy-pix" onclick="copyPixCode()"><i class="ri-file-copy-line"></i> Copiar</button>
        </div>

        <div style="font-size: 11px; color: var(--text-light); display: flex; align-items: center; gap: 4px;">
          <i class="ri-time-line"></i> Este código expira em 14:59 minutos
        </div>
      </div>

      <!-- Conteúdo Cartão de Crédito -->
      <div id="card-payment-box" class="credit-card-form" style="${AppState.booking.paymentMethod === 'card' ? '' : 'display: none;'}">
        <div class="form-group">
          <label>Número do Cartão</label>
          <input type="text" class="form-input" placeholder="0000 0000 0000 0000" maxlength="19">
        </div>
        <div class="form-group">
          <label>Nome Impresso no Cartão</label>
          <input type="text" class="form-input" placeholder="Ex: CARLOS E MENDES">
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label>Validade</label>
            <input type="text" class="form-input" placeholder="MM/AA" maxlength="5">
          </div>
          <div class="form-group">
            <label>CVV</label>
            <input type="password" class="form-input" placeholder="123" maxlength="4">
          </div>
        </div>
      </div>

      <!-- Selo de Garantia -->
      <div class="d-flex align-center justify-between mt-3 text-muted" style="font-size: 12px; padding: 0 4px;">
        <span><i class="ri-lock-2-line text-primary"></i> Pagamento 100% Criptografado</span>
        <span><i class="ri-shield-check-line text-primary"></i> Garantia Recarga Fácil</span>
      </div>
    </div>

    <!-- Barra Fixa Inferior de Confirmação (Sempre Ancorada no Rodapé) -->
    <div class="sticky-bottom-action-bar">
      <button id="btn-confirm-payment" class="btn btn-primary btn-block" onclick="handleProcessPayment()">
        <i class="ri-check-double-line"></i> Confirmar e Pagar R$ ${AppState.booking.total.toFixed(2).replace('.', ',')}
      </button>
    </div>
  `;
}

function switchPaymentTab(method) {
  AppState.booking.paymentMethod = method;
  renderScreenCheckout();
}

function copyPixCode() {
  const input = document.getElementById('pix-copy-field');
  if (input) {
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast("Código Pix copiado com sucesso!");
  }
}

async function handleProcessPayment() {
  const btn = document.getElementById('btn-confirm-payment');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Processando pagamento seguro...`;
  }

  await ApiService.processPayment({
    reservaId: AppState.booking.reservaId || 1,
    total: AppState.booking.total,
    platformFee: AppState.booking.platformFee
  });

  // Registra no histórico do usuário
  const wb = AppState.selectedWallbox || WALLBOXES_DATA[0];
  AppState.userBookings.unshift({
    id: `res-${Date.now()}`,
    code: AppState.booking.reservationCode,
    wallboxTitle: wb.title,
    wallboxPhoto: wb.photo,
    power: wb.power,
    date: AppState.booking.date,
    time: `${AppState.booking.timeSlot} (${AppState.booking.durationHours}h)`,
    total: AppState.booking.total,
    fee25: AppState.booking.platformFee,
    status: "CONCLUIDA",
    address: wb.unlockedAddress ? `${wb.unlockedAddress.street}, ${wb.unlockedAddress.number} - ${wb.unlockedAddress.neighborhood}` : "Endereço liberado",
    accessNotes: wb.unlockedAddress ? wb.unlockedAddress.accessInstructions : "Acesso liberado"
  });

  setTimeout(() => {
    navigateTo('screen-success');
    showToast("Pagamento aprovado! Endereço desbloqueado.");
  }, 1000);
}

// Tela 5: Sucesso & Desbloqueio do Endereço Completo e Instruções de Acesso
function renderScreenSuccess() {
  const wb = AppState.selectedWallbox || WALLBOXES_DATA[0];
  const addr = wb.unlockedAddress || {
    street: "Rua Antonio Perez Hernandez",
    number: "480",
    complement: "Condomínio Residencial Terra Nova - Casa 34",
    neighborhood: "Parque Campolim",
    zipCode: "18048-115",
    city: "Sorocaba",
    state: "SP",
    accessInstructions: "Identifique-se na portaria com o código de reserva. Ao entrar, vire na 2ª à esquerda, Casa 34. A Wallbox fica na garagem da direita. O anfitrião Carlos já foi notificado.",
    hostPhone: "+5515998765432"
  };
  const container = document.getElementById('success-content-placeholder');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-scroll-body" style="padding: 20px 16px 30px 16px;">
      <!-- Header de Sucesso -->
      <div class="success-header-banner">
        <div class="success-icon-circle">
          <i class="ri-check-line"></i>
        </div>
        <h2>Recarga Confirmada!</h2>
        <p>Sua vaga está garantida. O anfitrião foi avisado.</p>
      </div>

      <!-- CARD DE ENDEREÇO TOTALMENTE DESBLOQUEADO -->
      <div class="unlocked-address-card">
        <div class="unlocked-header-badge">
          <i class="ri-lock-unlock-fill"></i> Endereço e Acesso Desbloqueados
        </div>
        
        <div class="full-address-text">
          ${addr.street}, nº ${addr.number}
        </div>
        <div class="complement-text">
          ${addr.complement} • Bairro ${addr.neighborhood}<br>
          CEP: ${addr.zipCode} — ${addr.city}/${addr.state}
        </div>

        <!-- Instruções Exclusivas de Acesso ao Imóvel -->
        <div class="access-instructions-box">
          <strong><i class="ri-information-line"></i> Instruções do Anfitrião:</strong><br>
          ${addr.accessInstructions}
        </div>

        <!-- Ações de Rota (Waze / Google Maps) -->
        <div class="route-actions-row">
          <a href="https://waze.com/ul?ll=${wb.lat},${wb.lng}&navigate=yes" target="_blank" class="btn btn-waze">
            <i class="ri-navigation-line"></i> Abrir no Waze
          </a>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${wb.lat},${wb.lng}" target="_blank" class="btn btn-gmaps">
            <i class="ri-map-pin-line"></i> Google Maps
          </a>
        </div>

        <!-- Contato Direto com Anfitrião -->
        <a href="https://api.whatsapp.com/send?phone=${addr.hostPhone}&text=Ol%C3%A1%20${wb.hostName},%20acabei%20de%20reservar%20a%20Wallbox%20pelo%20Recarga%20F%C3%A1cil!" target="_blank" class="btn btn-whatsapp">
          <i class="ri-whatsapp-line"></i> Chamar ${wb.hostName ? wb.hostName.split(' ')[0] : 'Anfitrião'} no WhatsApp
        </a>
      </div>

      <!-- Voucher / Código de Reserva -->
      <div class="checkin-voucher">
        <div>
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">CÓDIGO DE IDENTIFICAÇÃO</div>
          <div class="voucher-code">${AppState.booking.reservationCode}</div>
        </div>
        <div style="text-align: right; font-size: 12px;">
          <strong>${AppState.booking.date}</strong><br>
          <span class="text-muted">${AppState.booking.timeSlot}</span>
        </div>
      </div>

      <!-- Botões de Ação -->
      <div class="d-flex gap-2 mt-4">
        <button class="btn btn-secondary" style="flex: 1;" onclick="navigateTo('screen-bookings-list')">
          <i class="ri-calendar-todo-line"></i> Ver Recargas
        </button>
        <button class="btn btn-primary" style="flex: 1;" onclick="navigateTo('screen-search')">
          <i class="ri-map-pin-2-line"></i> Ir para Mapa
        </button>
      </div>
    </div>
  `;
}

/* ==========================================================================
   8. BINDING DE EVENTOS
   ========================================================================== */
function bindNavigationEvents() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      if (target) {
        navigateTo(target);
      }
    });
  });
}

function bindFilterEvents() {
  document.querySelectorAll('.filter-chip[data-type]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip[data-type]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      AppState.activeTypeFilter = chip.getAttribute('data-type');
      renderMapMarkers();
      showToast(`Exibindo: ${chip.textContent.trim()}`);
    });
  });

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value;
      renderMapMarkers();
    });
  }
}

function showToast(message) {
  const toast = document.getElementById('app-toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function initTimeStatusBar() {
  const timeEl = document.getElementById('status-bar-time');
  if (!timeEl) return;

  const updateTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = `${hours}:${minutes}`;
  };

  updateTime();
  setInterval(updateTime, 30000);
}

function bindDesktopToggle() {
  const btn = document.getElementById('toggle-frame-btn');
  const container = document.querySelector('.app-container');
  if (!btn || !container) return;

  btn.addEventListener('click', () => {
    container.classList.toggle('phone-frame');
    container.classList.toggle('fullscreen-mode');
    const isFrame = container.classList.contains('phone-frame');
    btn.textContent = isFrame ? 'Modo Tela Cheia' : 'Modo Celular';
    
    if (AppState.map) {
      setTimeout(() => AppState.map.invalidateSize(), 300);
    }
  });
}
