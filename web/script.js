// --- CONFIG & STATE ---
const FINNHUB_API_KEY = 'd1kojdpr01qt8fopkmcgd1kojdpr01qt8fopkmd0'; // Publicly available key, consider securing it
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const EXCHANGE_RATES_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD'; // Free exchange rate API
const INITIAL_CASH = 100000; // Define initial cash as a constant

const MARKET_OVERVIEW_SYMBOLS = [
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    { symbol: 'DIA', name: 'Dow Jones ETF' },
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'TSLA', name: 'Tesla, Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.'},
    { symbol: 'JPM', name: 'JPMorgan Chase & Co'},
    { symbol: 'V', name: 'Visa Inc.'}
];

let userLocation = null; // Variable to store the user's location

const initialState = {
    user: null,
    sessionId: null,
    currentStock: null,
    currentStockPrice: 0,
    chartInstances: { main: null, portfolio: null },
    searchModal: null,
    tradeModal: null,
    appToast: null,
    currency: 'USD',
    exchangeRates: {},
    userUnsubscribe: null,
    cartUnsubscribe: null,
};

let state = { ...initialState };


// --- APP INITIALIZATION ---

async function initializeMainApp(user) {
    if (state.userUnsubscribe) state.userUnsubscribe();

    const userRef = db.collection('users').doc(user.uid);
    let initialCheck = true;
    let docCreationTimeout;

    state.userUnsubscribe = userRef.onSnapshot(async (doc) => {
        clearTimeout(docCreationTimeout);

        if (doc.exists) {
            const wasJustUpdated = state.user !== null;
            initialCheck = false; 
            state.user = doc.data();
            
            if (!wasJustUpdated) {
                 updateUIAfterLogin();
            }

            // Refresh the profile page if it's currently active to show new data
            if (document.getElementById('profile-content').classList.contains('active-content')) {
                renderProfilePage();
            }
            
            if (document.getElementById('portfolio-content').classList.contains('active-content')) {
                renderPortfolioPage();
            }

            if (document.getElementById('stock-detail-page').classList.contains('active')) {
                renderWatchlistButton(state.currentStock);
            }

            const sessionId = localStorage.getItem('sessionId');
            if (sessionId) {
                await mergeSessionCart(sessionId, user.uid);
            }
        } else {
            if (initialCheck) {
                console.warn("User document not found. Waiting for creation (this is normal on registration)...");
                initialCheck = false; 
                docCreationTimeout = setTimeout(() => {
                    console.error("User document was not created in time. Logging out.");
                    handleLogout();
                }, 3500);
            } else {
                 console.error("User document not found in Firestore after initial check! Logging out.");
                 handleLogout();
            }
        }
    }, error => {
        console.error("Error listening to user data:", error);
        showAppToast("Could not load user data.", "error");
    });
}

function initializeGuestApp() {
    state.user = null;
    if (!localStorage.getItem('sessionId')) {
        localStorage.setItem('sessionId', crypto.randomUUID());
    }
    state.sessionId = localStorage.getItem('sessionId');
    updateUIAfterLogin();
}

function updateUIAfterLogin() {
    const username = state.user ? state.user.fullName : 'Guest';
    const userInitial = username ? username[0].toUpperCase() : 'G';
    
    document.getElementById('dashboard-username').innerText = username;
    document.querySelector('.user-avatar').src = `https://placehold.co/100x100/E2E8F0/4A5568?text=${userInitial}`;
    
    const adminNavLink = document.getElementById('admin-nav-link');
    if (state.user && state.user.isAdmin) {
        adminNavLink.classList.remove('d-none');
    } else {
        adminNavLink.classList.add('d-none');
    }
    
    navigateToPage('home-page');
    const activeContent = document.querySelector('.main-content-area.active-content') || document.getElementById('markets-content');
    showMainContent(activeContent.id);
}


// --- API & UTILITY FUNCTIONS ---
async function apiRequest(endpoint) {
    if (!FINNHUB_API_KEY) {
        showAppToast("Finnhub API key is missing.", "error");
        return null;
    }
    try {
        const response = await fetch(`${FINNHUB_BASE_URL}${endpoint}&token=${FINNHUB_API_KEY}`);
        if (!response.ok) {
            if (response.status === 429) console.warn("API rate limit exceeded.");
            return null;
        }
        return await response.json();
    } catch (error) { console.error("API Error:", error); return null; }
}

function formatCurrency(value) {
    if (typeof value !== 'number') return `${state.currency} --.--`;
    const rate = state.exchangeRates[state.currency] || 1;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.currency }).format(value * rate);
}

function formatPercentage(value) {
    if (typeof value !== 'number') return '--%';
    return `${value.toFixed(2)}%`;
}

function getChangeClass(value) { return value >= 0 ? 'text-brand-green' : 'text-brand-red'; }
async function getQuote(ticker) { return apiRequest(`/quote?symbol=${ticker}`); }
async function getProfile(ticker) { return apiRequest(`/stock/profile2?symbol=${ticker}`); }
async function getCompanyNews(ticker) {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return apiRequest(`/company-news?symbol=${ticker}&from=${from}&to=${to}`);
}
async function searchSymbols(query) { return apiRequest(`/search?q=${query}`); }
async function getStockCandles(ticker, resolution, from, to) {
    return apiRequest(`/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${to}`);
}

async function fetchExchangeRates() {
    try {
        const response = await fetch(EXCHANGE_RATES_API_URL);
        const data = await response.json();
        state.exchangeRates = data.rates;
        state.exchangeRates['USD'] = 1; // Ensure USD base rate is present
    } catch (error) {
        console.error("Could not fetch exchange rates:", error);
        showAppToast("Could not fetch currency rates.", "warning");
    }
}

/**
 * Detects user location via IP address for initial registration.
 * @returns {Promise<string|null>} A string like "City, Country" or null.
 */
async function detectUserLocation() {
    try {
        const response = await fetch('https://ip-api.com/json/');
        if (!response.ok) return null;
        const data = await response.json();
        if (data.city && data.country) {
            return `${data.city}, ${data.country}`;
        }
        return data.country || null;
    } catch (error) {
        console.warn("Could not detect user location:", error);
        return null;
    }
}

/**
 * Asks for browser location, gets a readable address, and updates Firestore.
 */
async function updateUserLocation() {
    if (!navigator.geolocation) {
        showAppToast("Geolocation is not supported by your browser.", "error");
        return;
    }

    const updateLocationDisplay = (text) => {
        const display = document.getElementById('user-location-display');
        if (display) display.innerText = text;
    };

    updateLocationDisplay("Locating..."); // Provide immediate feedback

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;

        try {
            // Use a free reverse geocoding API to get the city and country
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
            if (!response.ok) throw new Error("Could not fetch location name.");

            const data = await response.json();
            const locationString = `${data.city}, ${data.countryName}`;

            // Update the location in Firestore
            const userRef = db.collection('users').doc(state.user.uid);
            await userRef.update({ location: locationString });

            showAppToast("Location updated successfully!", "success");
            // The onSnapshot listener will automatically update the UI

        } catch (error) {
            console.error("Error updating location:", error);
            showAppToast("Could not update your location.", "error");
            updateLocationDisplay(state.user.location || 'Unknown Location'); // Revert on failure
        }

    }, (error) => {
        // Handle errors like user denying permission
        console.error("Geolocation error:", error.message);
        showAppToast(`Location Error: ${error.message}`, "error");
        updateLocationDisplay(state.user.location || 'Unknown Location'); // Revert on failure
    });
}


// --- UI & NAVIGATION ---
function navigateToPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
}

function showAuthSubPage(subPageId) {
    navigateToPage('auth-container');
    document.querySelectorAll('.auth-sub-page').forEach(p => p.classList.add('d-none'));
    document.getElementById(subPageId)?.classList.remove('d-none');
}

function showMainContent(targetId) {
    if (state.cartUnsubscribe) {
        state.cartUnsubscribe();
        state.cartUnsubscribe = null;
    }

    document.querySelectorAll('.main-content-area').forEach(area => {
        area.style.display = 'none';
        area.classList.remove('active-content');
    });
    const targetArea = document.getElementById(targetId);
    if (targetArea) {
        targetArea.style.display = 'block';
        targetArea.classList.add('active-content');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.target === targetId);
    });

    switch (targetId) {
        case 'markets-content': renderMarketsPage(); break;
        case 'portfolio-content': renderPortfolioPage(); break;
        case 'wishlist-content': renderWishlistPage(); break;
        case 'news-content': renderNewsPage(); break;
        case 'cart-content': renderShoppingCartPage(); break;
        case 'pro-content': renderProPage(); break; 
        case 'profile-content': renderProfilePage(); break;
        case 'admin-content': renderAdminPage(); break;
    }
}

function showAppToast(message, type = 'info') {
    if (!state.appToast) return;
    const toastBody = document.getElementById('toast-body-content');
    toastBody.textContent = message;
    
    const toastEl = document.getElementById('app-toast');
    toastEl.classList.remove('text-bg-success', 'text-bg-danger', 'text-bg-warning');
    if (type === 'success') toastEl.classList.add('text-bg-success');
    else if (type === 'error') toastEl.classList.add('text-bg-danger');
    else if (type === 'warning') toastEl.classList.add('text-bg-warning');

    state.appToast.show();
}

/**
 * **MODIFIED**
 * Updates all elements with the 'currency-display' class to the new currency.
 */
function updateAllCurrencyDisplays() {
    document.querySelectorAll('.currency-display').forEach(el => {
        const usdValue = parseFloat(el.dataset.usdValue);
        if (!isNaN(usdValue)) {
            el.innerText = formatCurrency(usdValue);
        }
    });
}

/**
 * **NEW**
 * Handles the logic for changing the currency and updating the UI.
 */
async function handleCurrencyChange(newCurrency) {
    state.currency = newCurrency;
    document.getElementById('currency-selector').innerText = state.currency;
    
    // Update all simple price displays
    updateAllCurrencyDisplays();

    // Check if a chart is active and needs re-rendering for tooltip updates
    const portfolioContent = document.getElementById('portfolio-content');
    const stockDetailPage = document.getElementById('stock-detail-page');

    if (portfolioContent.classList.contains('active-content')) {
        // Re-render portfolio chart
        const portfolioValue = parseFloat(document.getElementById('portfolio-total-value').dataset.usdValue);
        if (!isNaN(portfolioValue)) {
            updatePortfolioChart(document.querySelector('#portfolio-chart-timeframe-selector .active').dataset.range, portfolioValue);
        }
    } else if (stockDetailPage.classList.contains('active')) {
        // Re-render stock chart
        updateStockChart(document.querySelector('#chart-timeframe-selector .active').dataset.range);
    }
}


// --- RENDER FUNCTIONS ---
async function renderHomePageSummary() {
    if (!document.getElementById('summary-portfolio-value') || !state.user) return;
    
    const cashEl = document.getElementById('summary-available-cash');
    const portfolioValueEl = document.getElementById('summary-portfolio-value');

    // Add data attributes and class for currency conversion
    cashEl.dataset.usdValue = state.user.cash;
    cashEl.classList.add('currency-display');
    cashEl.innerText = formatCurrency(state.user.cash);

    if (state.user.portfolio && state.user.portfolio.length > 0) {
        const quotes = await Promise.all(state.user.portfolio.map(h => getQuote(h.ticker)));
        const totalValue = quotes.reduce((acc, q, i) => acc + (q && q.c ? q.c * state.user.portfolio[i].shares : 0), 0);
        
        portfolioValueEl.dataset.usdValue = totalValue;
        portfolioValueEl.classList.add('currency-display');
        portfolioValueEl.innerText = formatCurrency(totalValue);
    } else {
        portfolioValueEl.dataset.usdValue = 0;
        portfolioValueEl.classList.add('currency-display');
        portfolioValueEl.innerText = formatCurrency(0);
    }
}

async function renderMarketOverview() {
    const container = document.getElementById('market-indices-container');
    if (!container) return;

    try {
        const quotes = await Promise.all(MARKET_OVERVIEW_SYMBOLS.map(index => getQuote(index.symbol)));
        
        container.innerHTML = quotes.map((quote, i) => {
            if (!quote || typeof quote.c !== 'number') {
                return `<div class="col-md-4 col-6"><div class="index-card negative"><div class="index-name">${MARKET_OVERVIEW_SYMBOLS[i].name}</div><div class="index-value">Error</div><div class="index-change"><span>--</span></div></div></div>`;
            }
            
            const isPositive = quote.d >= 0;
            const cardClass = isPositive ? 'positive' : 'negative';
            const changeIcon = isPositive ? '<i class="bi bi-arrow-up-right"></i>' : '<i class="bi bi-arrow-down-right"></i>';

            // Add data attributes and class for currency conversion
            return `
                <div class="col-md-4 col-6">
                    <a href="#" class="index-card ${cardClass}" onclick="event.preventDefault(); showStockDetail('${MARKET_OVERVIEW_SYMBOLS[i].symbol}')">
                        <div class="index-name">${MARKET_OVERVIEW_SYMBOLS[i].name}</div>
                        <div class="index-value currency-display" data-usd-value="${quote.c}">${formatCurrency(quote.c)}</div>
                        <div class="index-change">
                            <span class="currency-display" data-usd-value="${quote.d}">${formatCurrency(quote.d)} (${quote.dp.toFixed(2)}%)</span>
                            ${changeIcon}
                        </div>
                    </a>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Could not fetch market overview:", error);
        container.innerHTML = `<p class="text-secondary text-center">Could not load market overview.</p>`;
    }
}


function renderMarketsPage() {
    renderHomePageSummary();
    renderMarketOverview();
}

async function renderPortfolioPage() {
    const container = document.getElementById('portfolio-content');
    if (!container) return;
    if (!state.user) {
        container.innerHTML = `<h2 class="h3 fw-bold mb-4">Portfolio</h2><p class="text-secondary text-center p-4">Please <a href="#" onclick="showAuthSubPage('login-page')">log in</a> to view your portfolio.</p>`;
        return;
    }

    const assetsListContainer = document.getElementById('portfolio-assets-list');
    assetsListContainer.innerHTML = `<div class="text-center p-5"><div class="spinner-border" role="status"></div></div>`;

    const assetsWithQuotes = await Promise.all(
        state.user.portfolio.map(async h => ({ ...h, quote: await getQuote(h.ticker) }))
    );

    const portfolioValue = assetsWithQuotes.reduce((acc, asset) => {
        return acc + (asset.quote && asset.quote.c ? asset.quote.c * asset.shares : 0);
    }, 0);

    const dayChangeValue = assetsWithQuotes.reduce((acc, asset) => {
        return acc + (asset.quote && asset.quote.d ? asset.quote.d * asset.shares : 0);
    }, 0);
    
    const previousDayValue = portfolioValue - dayChangeValue;
    const dayChangePercent = previousDayValue === 0 ? 0 : (dayChangeValue / previousDayValue) * 100;

    // Add data attributes and classes for currency conversion
    const totalValueEl = document.getElementById('portfolio-total-value');
    totalValueEl.dataset.usdValue = portfolioValue;
    totalValueEl.classList.add('currency-display');
    totalValueEl.innerText = formatCurrency(portfolioValue);

    const dayChangeEl = document.getElementById('portfolio-day-change');
    dayChangeEl.dataset.usdValue = dayChangeValue;
    dayChangeEl.classList.add('currency-display');
    dayChangeEl.innerText = `${formatCurrency(dayChangeValue)} (${formatPercentage(dayChangePercent)}) Today`;
    dayChangeEl.className = `fw-semibold currency-display ${getChangeClass(dayChangeValue)}`;

    const availableCashEl = document.getElementById('portfolio-available-cash');
    availableCashEl.dataset.usdValue = state.user.cash;
    availableCashEl.classList.add('currency-display');
    availableCashEl.innerText = formatCurrency(state.user.cash);
    
    const cashChange = state.user.cash - INITIAL_CASH;
    const cashChangePercent = (cashChange / INITIAL_CASH) * 100;
    const cashChangeEl = document.getElementById('portfolio-cash-change');
    cashChangeEl.dataset.usdValue = cashChange;
    cashChangeEl.classList.add('currency-display');
    cashChangeEl.innerText = `${formatCurrency(cashChange)} (${formatPercentage(cashChangePercent)})`;
    cashChangeEl.className = `fw-semibold currency-display ${getChangeClass(cashChange)}`;

    if (assetsWithQuotes.length === 0) {
        assetsListContainer.innerHTML = `<p class="text-secondary text-center p-4">Your portfolio is empty.</p>`;
    } else {
        assetsListContainer.innerHTML = assetsWithQuotes.map(asset => {
            if (!asset.quote || typeof asset.quote.c !== 'number') return '';
            const value = asset.shares * asset.quote.c;
            return `<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="event.preventDefault(); showStockDetail('${asset.ticker}')">
                <div><img src="https://logo.clearbit.com/${(asset.ticker.toLowerCase())}.com" class="asset-logo me-3 rounded-circle" onerror="this.src='https://placehold.co/40x40?text=${asset.ticker[0]}'" alt="${asset.ticker}"><span class="fw-bold">${asset.ticker}</span><small class="d-block text-secondary">${asset.shares} shares</small></div>
                <div class="text-end"><p class="fw-bold mb-0 currency-display" data-usd-value="${value}">${formatCurrency(value)}</p><small class="${getChangeClass(asset.quote.d)}">${formatPercentage(asset.quote.dp)}</small></div>
            </a>`
        }).join('');
    }

    updatePortfolioChart('1D', portfolioValue);
    addPortfolioChartTimeframeListeners(portfolioValue);
}

function addPortfolioChartTimeframeListeners(currentPortfolioValue) {
    const selector = document.getElementById('portfolio-chart-timeframe-selector');
    const newSelector = selector.cloneNode(true);
    selector.parentNode.replaceChild(newSelector, selector);

    newSelector.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            newSelector.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            updatePortfolioChart(e.target.dataset.range, currentPortfolioValue);
        }
    });
}

async function updatePortfolioChart(range, basePrice) {
    const chartContainer = document.getElementById('portfolio-main-chart')?.parentElement;
    if (!chartContainer) return;

    const canvasEl = document.getElementById('portfolio-main-chart');
    if (state.chartInstances.portfolio) {
        state.chartInstances.portfolio.destroy();
    }
    
    const candles = getMockCandleData(state.user.uid, basePrice, range);
    
    const isPositive = candles.c[candles.c.length - 1] >= candles.c[0];
    const borderColor = isPositive ? '#22c55e' : '#ef4444';
    const gradient = canvasEl.getContext('2d').createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, isPositive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    state.chartInstances.portfolio = new Chart(canvasEl.getContext('2d'), {
        type: 'line',
        data: {
            labels: candles.t.map(t => new Date(t * 1000)),
            datasets: [{ 
                data: candles.c, 
                borderColor: borderColor, 
                borderWidth: 2, 
                pointRadius: 0, 
                tension: 0.1, 
                fill: true, 
                backgroundColor: gradient 
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            }, 
            scales: { 
                x: { type: 'time', display: false }, 
                y: { display: false } 
            } 
        }
    });
}


async function renderWishlistPage() {
    const container = document.getElementById('wishlist-content');
    if (!container) return;
     if (!state.user) {
        container.innerHTML = `<h2 class="h3 fw-bold mb-4">My Wishlist</h2><p class="text-secondary text-center p-4">Please <a href="#" onclick="showAuthSubPage('login-page')">log in</a> to manage your wishlist.</p>`;
        return;
    }
    container.innerHTML = `<h2 class="h3 fw-bold mb-4">My Wishlist</h2><div id="wishlist-list" class="list-group"><div class="text-center p-5"><div class="spinner-border" role="status"></div></div></div>`;
    const list = document.getElementById('wishlist-list');
    if (state.user.wishlist.length === 0) { list.innerHTML = `<p class="text-secondary text-center p-4">Your wishlist is empty. Add stocks by clicking the star icon on their detail page.</p>`; return; }
    
    const assets = await Promise.all(state.user.wishlist.map(async t => ({ ticker: t, quote: await getQuote(t) })));
    list.innerHTML = assets.map(asset => {
        if (!asset.quote || typeof asset.quote.c !== 'number') return '';
        return `<a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center" onclick="event.preventDefault(); showStockDetail('${asset.ticker}')">
            <div><img src="https://logo.clearbit.com/${(asset.ticker.toLowerCase())}.com" class="asset-logo me-3 rounded-circle" onerror="this.src='https://placehold.co/40x40?text=${asset.ticker[0]}'" alt="${asset.ticker}"><span class="fw-bold">${asset.ticker}</span></div>
            <div class="text-end"><p class="fw-bold mb-0 currency-display" data-usd-value="${asset.quote.c}">${formatCurrency(asset.quote.c)}</p><small class="${getChangeClass(asset.quote.d)}">${formatPercentage(asset.quote.dp)}</small></div>
        </a>`
    }).join('');
}

async function renderNewsPage() {
    const container = document.getElementById('news-content');
    if (!container) return;
    container.innerHTML = `<h2 class="h3 fw-bold mb-4">Market News</h2><div id="news-list-container" class="row g-4"><div class="text-center p-5"><div class="spinner-border" role="status"></div></div></div>`;
    
    const newsList = [];
    try {
        const snapshot = await db.collection('news').orderBy('datetime', 'desc').limit(20).get();
        snapshot.forEach(doc => newsList.push(doc.data()));
    } catch (error) {
        console.error("Error fetching news from Firestore:", error);
    }

    if (newsList.length === 0) {
        const apiNews = await apiRequest(`/news?category=general`);
        if (apiNews) newsList.push(...apiNews.slice(0, 20));
    }

    const newsContainer = document.getElementById('news-list-container');
    if (!newsList || newsList.length === 0) {
        newsContainer.innerHTML = '<p class="text-secondary">Could not load news.</p>';
        return;
    }
    newsContainer.innerHTML = newsList.map(article => `
        <div class="col-lg-6"><div class="card h-100 border-0 shadow-sm bg-body-tertiary">
            ${article.image ? `<img src="${article.image}" class="card-img-top" alt="News Image" style="height:200px;object-fit:cover" onerror="this.style.display='none'">` : ''}
            <div class="card-body d-flex flex-column">
                <h5 class="card-title fw-bold">${article.headline}</h5>
                <p class="card-text text-secondary small mb-3">${new Date(article.datetime * 1000).toLocaleDateString()}</p>
                <a href="${article.url}" target="_blank" class="btn btn-sm btn-outline-primary mt-auto">Read More</a>
            </div>
        </div></div>`).join('');
}

function renderProPage() {
    const container = document.getElementById('pro-content');
    container.innerHTML = `
        <div class="row justify-content-center">
            <div class="col-lg-8 text-center">
                <h2 class="h3 fw-bold mb-4">Upgrade to Stockly Pro</h2>
                <p class="lead text-secondary mb-5">Unlock premium features, advanced analytics, and a competitive edge in the market.</p>
            </div>
        </div>
        <div class="row justify-content-center g-4">
            <div class="col-md-5 col-lg-4">
                <div class="card bg-body-tertiary border-0 h-100 p-4">
                    <h3 class="fw-bold">Standard</h3>
                    <p class="display-4 fw-bolder mb-0">$0<span class="fs-5 text-secondary">/mo</span></p>
                    <ul class="list-unstyled mt-4 mb-5 text-start">
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-green me-2"></i>Real-time stock data</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-green me-2"></i>Portfolio tracking</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-green me-2"></i>Personal Wishlist</li>
                        <li class="mb-2 text-secondary"><i class="bi bi-x-circle me-2"></i>Advanced Charting</li>
                        <li class="mb-2 text-secondary"><i class="bi bi-x-circle me-2"></i>Zero-commission Trades</li>
                        <li class="mb-2 text-secondary"><i class="bi bi-x-circle me-2"></i>Priority Support</li>
                    </ul>
                </div>
            </div>
            <div class="col-md-5 col-lg-4">
                <div class="card bg-body-tertiary border-warning border-2 h-100 p-4">
                    <h3 class="fw-bold">Pro</h3>
                    <p class="display-4 fw-bolder mb-0 text-brand-amber">$9.99<span class="fs-5 text-secondary">/mo</span></p>
                     <ul class="list-unstyled mt-4 mb-5 text-start">
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-amber me-2"></i>All Standard features</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-amber me-2"></i>Advanced Charting Tools</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-amber me-2"></i>Zero-commission Trades</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-amber me-2"></i>AI-Powered Market Insights</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-amber me-2"></i>Export Portfolio Data</li>
                        <li class="mb-2"><i class="bi bi-check-circle-fill text-brand-amber me-2"></i>Priority Customer Support</li>
                    </ul>
                    <button class="btn btn-brand-gold w-100 fw-bold" onclick="showAppToast('Pro version coming soon!', 'info')">Select Pro</button>
                </div>
            </div>
        </div>`;
}


/**
 * Renders the main settings page with an "Edit Profile" button and location.
 */
function renderProfilePage() {
    const container = document.getElementById('profile-content');
    if (!state.user) {
        container.innerHTML = `<h2 class="h3 fw-bold mb-4">Settings</h2><p class="text-secondary text-center p-4">Please <a href="#" onclick="showAuthSubPage('login-page')">log in</a> to view settings.</p>`;
        return;
    }
    container.innerHTML = `
        <h2 class="h3 fw-bold mb-4">Account Settings</h2>
        <div class="card border-0 bg-body-tertiary rounded-4 p-4 mb-4">
            <div class="d-flex align-items-center mb-4">
                <img class="user-avatar-large rounded-circle" src="https://placehold.co/100x100/E2E8F0/4A5568?text=${state.user.fullName[0]}" alt="User profile picture">
                <div class="ms-3">
                    <h3 class="h5 fw-bold mb-0">${state.user.fullName}</h3>
                    <p class="text-secondary small mb-0">${state.user.email}</p>
                    <div class="d-flex align-items-center text-secondary small mb-0 mt-1">
                         <i class="bi bi-geo-alt-fill me-1"></i>
                         <span id="user-location-display">${state.user.location || 'Unknown Location'}</span>
                    </div>
                </div>
            </div>
            <div class="d-grid gap-2" style="grid-template-columns: 1fr 1fr;">
                <button id="edit-profile-btn" class="btn btn-primary">Edit Profile</button>
                <button id="update-location-btn" class="btn btn-secondary">Update Location</button>
            </div>
        </div>
        <div class="card border-0 bg-body-tertiary rounded-4 p-4 mb-4">
            <h4 class="h6 fw-bold mb-3">Preferences</h4>
            <div class="d-flex justify-content-between align-items-center mb-3">
                <label for="theme-toggle" class="form-check-label">Dark Mode</label>
                <div class="form-check form-switch">
                    <input type="checkbox" id="theme-toggle" class="form-check-input" role="switch">
                </div>
            </div>
        </div>
        <div class="d-grid">
            <button id="logout-button" class="btn btn-danger">Log Out</button>
        </div>`;
    
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.checked = document.documentElement.dataset.bsTheme === 'dark';
    themeToggle.addEventListener('change', () => {
        document.documentElement.dataset.bsTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', document.documentElement.dataset.bsTheme);
    });

    document.getElementById('logout-button').addEventListener('click', handleLogout);
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
        renderEditProfilePage();
        navigateToPage('edit-profile-page');
    });
    document.getElementById('update-location-btn').addEventListener('click', updateUserLocation);
}

/**
 * Renders the content for the Edit Profile page, including the location.
 */
function renderEditProfilePage() {
    const container = document.getElementById('edit-profile-page');
    if (!container || !state.user) return;

    const userInitial = state.user.fullName ? state.user.fullName[0].toUpperCase() : 'U';

    container.innerHTML = `
        <div class="container-fluid py-3">
            <header class="d-flex align-items-center mb-4">
                <button class="btn btn-link p-2" onclick="showMainContent('profile-content'); navigateToPage('home-page');"><i class="bi bi-arrow-left fs-4"></i></button>
                <h1 class="h4 fw-bold text-body-emphasis mb-0 ms-2">Edit Profile</h1>
            </header>
            <div class="max-w-xl mx-auto w-100">
                <div class="card bg-body-tertiary border-0 rounded-4 p-4">
                    <form id="edit-profile-form">
                        <div class="text-center mb-4">
                            <img class="user-avatar-large rounded-circle mb-2" src="https://placehold.co/100x100/E2E8F0/4A5568?text=${userInitial}" alt="User profile picture">
                            <div><a href="#" class="small" onclick="showAppToast('Feature coming soon!', 'info')">Change Picture</a></div>
                        </div>

                        <div class="mb-3">
                            <label for="edit-fullname" class="form-label">Full Name</label>
                            <input type="text" id="edit-fullname" class="form-control" value="${state.user.fullName}" required>
                        </div>
                        <div class="mb-3">
                            <label for="edit-email" class="form-label">Email address</label>
                            <input type="email" id="edit-email" class="form-control" value="${state.user.email}" disabled>
                        </div>
                        <div class="mb-3">
                            <label for="edit-location" class="form-label">Location</label>
                            <input type="text" id="edit-location" class="form-control" value="${state.user.location || 'Unknown Location'}" disabled>
                        </div>
                        <hr class="my-4">
                        <h5 class="mb-3">Change Password</h5>
                        <div class="mb-3">
                            <label for="edit-new-password" class="form-label">New Password</label>
                            <input type="password" id="edit-new-password" class="form-control" placeholder="Leave blank to keep current password">
                        </div>
                        <div class="mb-3">
                            <label for="edit-confirm-password" class="form-label">Confirm New Password</label>
                            <input type="password" id="edit-confirm-password" class="form-control">
                        </div>
                        <div class="d-grid mt-4">
                            <button type="submit" class="btn btn-brand-green">Save Changes</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById('edit-profile-form').addEventListener('submit', handleUpdateProfile);
}

async function handleUpdateProfile(event) {
    event.preventDefault();
    const fullName = document.getElementById('edit-fullname').value;
    const newPassword = document.getElementById('edit-new-password').value;
    const confirmPassword = document.getElementById('edit-confirm-password').value;

    if (newPassword && newPassword.length < 6) {
        showAppToast("Password must be at least 6 characters long.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showAppToast("Passwords do not match.", "error");
        return;
    }

    const updates = {};
    if (fullName !== state.user.fullName) {
        updates.fullName = fullName;
    }

    try {
        if (newPassword) {
            const passwordUpdated = await handleUpdatePassword(newPassword);
            if (!passwordUpdated) return; // Stop if password update fails
        }

        if (Object.keys(updates).length > 0) {
            const userRef = db.collection('users').doc(state.user.uid);
            await userRef.update(updates);
        }

        showAppToast("Profile updated successfully!", "success");
        showMainContent('profile-content');
        navigateToPage('home-page');

    } catch (error) {
        console.error("Profile update failed:", error);
        showAppToast(`Error: ${error.message}`, 'error');
    }
}


function renderAdminPage() {
    const container = document.getElementById('admin-content');
    if (!state.user || !state.user.isAdmin) {
        container.innerHTML = `<p class="text-secondary text-center p-5">You do not have permission to view this page.</p>`;
        return;
    }
    container.innerHTML = `
        <h2 class="h3 fw-bold mb-4">Admin Panel - Add News</h2>
        <div class="card bg-body-tertiary border-0">
            <div class="card-body">
                <form id="add-news-form">
                    <div class="mb-3">
                        <label for="news-headline" class="form-label">Headline</label>
                        <input type="text" id="news-headline" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label for="news-url" class="form-label">Article URL</label>
                        <input type="url" id="news-url" class="form-control" required>
                    </div>
                    <div class="mb-3">
                        <label for="news-image" class="form-label">Image URL (Optional)</label>
                        <input type="url" id="news-image" class="form-control">
                    </div>
                    <div class="mb-3">
                        <label for="news-source" class="form-label">Source (e.g., Reuters)</label>
                        <input type="text" id="news-source" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Add News Article</button>
                </form>
            </div>
        </div>`;
    document.getElementById('add-news-form').addEventListener('submit', handleAddNews);
}

async function handleAddNews(event) {
    event.preventDefault();
    const headline = document.getElementById('news-headline').value;
    const url = document.getElementById('news-url').value;
    const image = document.getElementById('news-image').value;
    const source = document.getElementById('news-source').value;

    const newArticle = {
        headline, url, image, source,
        datetime: Math.floor(Date.now() / 1000),
        id: crypto.randomUUID()
    };

    try {
        await db.collection('news').add(newArticle);
        showAppToast("News article added successfully!", 'success');
        event.target.reset();
    } catch (error) {
        console.error("Error adding news:", error);
        showAppToast("Failed to add news article.", 'error');
    }
}


async function showStockDetail(ticker) {
    state.currentStock = ticker;
    navigateToPage('stock-detail-page');
    const contentArea = document.getElementById('stock-detail-page');
    contentArea.innerHTML = `<div class="container-fluid py-3"><div class="text-center p-5"><div class="spinner-border" role="status"></div></div></div>`;
    
    const [quote, profile, news] = await Promise.all([
        getQuote(ticker), 
        getProfile(ticker),
        getCompanyNews(ticker)
    ]);

    if (!quote || typeof quote.c !== 'number') {
        contentArea.innerHTML = `<div class="container-fluid py-3"><header class="d-flex"><button class="btn btn-link p-2" onclick="navigateToPage('home-page')"><i class="bi bi-arrow-left fs-4"></i></button></header><p class="text-secondary text-center p-4">Could not load details for ${ticker}.</p></div>`;
        return;
    }

    let displayName = profile.name;
    if (!displayName) {
        const indexInfo = MARKET_OVERVIEW_SYMBOLS.find(i => i.symbol === ticker);
        if (indexInfo) {
            displayName = indexInfo.name;
        }
    }
    
    state.currentStockPrice = quote.c; 
    
    const sharesOwned = state.user?.portfolio.find(h => h.ticker === ticker)?.shares || 0;
    
    const newsHtml = (news && news.length > 0) 
        ? news.slice(0, 5).map(article => `
            <a href="${article.url}" target="_blank" class="list-group-item list-group-item-action">
                <p class="fw-bold mb-1">${article.headline}</p>
                <small class="text-secondary">${new Date(article.datetime * 1000).toLocaleDateString()}</small>
            </a>`).join('') 
        : '<p class="text-secondary p-2">No recent news found for this stock.</p>';

    contentArea.innerHTML = `
        <div class="container-fluid py-3">
            <header class="d-flex justify-content-between align-items-center mb-4">
                <button class="btn btn-link p-2" onclick="showMainContent('markets-content'); navigateToPage('home-page');"><i class="bi bi-arrow-left fs-4"></i></button>
                <h1 class="h5 fw-bold text-body-emphasis mb-0">${profile.ticker || ticker}</h1>
                <div id="watchlist-action-container" style="width:40px"></div>
            </header>
            <div class="max-w-xl mx-auto w-100">
                <p class="text-secondary h5">${displayName || ''}</p>
                <div class="d-flex align-items-end gap-3">
                    <p class="display-4 fw-bold mb-0 currency-display" data-usd-value="${quote.c}">${formatCurrency(quote.c)}</p>
                    <p class="h5 fw-semibold mb-2 ${getChangeClass(quote.d)}">
                        <span class="currency-display" data-usd-value="${quote.d}">${quote.d >= 0 ? '+' : ''}${formatCurrency(quote.d)}</span> 
                        (${formatPercentage(quote.dp)})
                    </p>
                </div>
                
                <div class="d-flex justify-content-end mb-2">
                    <div class="btn-group btn-group-sm" role="group" id="chart-timeframe-selector">
                        <button type="button" class="btn btn-outline-secondary" data-range="1D">1D</button>
                        <button type="button" class="btn btn-outline-secondary" data-range="1W">1W</button>
                        <button type="button" class="btn btn-outline-secondary" data-range="1M">1M</button>
                        <button type="button" class="btn btn-outline-secondary active" data-range="1Y">1Y</button>
                    </div>
                </div>
                <div class="chart-container-large">
                    <canvas id="mainStockChart"></canvas>
                </div>

                <div class="card bg-body-tertiary border-0 my-4">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-6 mb-2"><strong>Open:</strong> <span class="currency-display" data-usd-value="${quote.o}">${formatCurrency(quote.o)}</span></div>
                            <div class="col-6 mb-2"><strong>High:</strong> <span class="currency-display" data-usd-value="${quote.h}">${formatCurrency(quote.h)}</span></div>
                            <div class="col-6"><strong>Low:</strong> <span class="currency-display" data-usd-value="${quote.l}">${formatCurrency(quote.l)}</span></div>
                            <div class="col-6"><strong>Prev. Close:</strong> <span class="currency-display" data-usd-value="${quote.pc}">${formatCurrency(quote.pc)}</span></div>
                        </div>
                    </div>
                </div>

                <div class="d-grid gap-3" style="grid-template-columns:1fr 1fr"><button class="btn btn-brand-green btn-lg fw-bold" onclick="openTradeModal('${ticker}','buy')">Buy</button><button class="btn btn-brand-red btn-lg fw-bold" onclick="openTradeModal('${ticker}','sell')" ${!sharesOwned ? 'disabled' : ''}>Sell</button></div>
                
                <div class="mt-5">
                    <h3 class="h4 fw-bold mb-3">Relevant News</h3>
                    <div class="list-group">${newsHtml}</div>
                </div>
            </div>
        </div>`;
    renderWatchlistButton(ticker);
    updateStockChart('1Y');
    addChartTimeframeListeners();
}

function addChartTimeframeListeners() {
    const selector = document.getElementById('chart-timeframe-selector');
    const newSelector = selector.cloneNode(true);
    selector.parentNode.replaceChild(newSelector, selector);

    newSelector.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            newSelector.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            updateStockChart(e.target.dataset.range);
        }
    });
}

function renderWatchlistButton(ticker) {
    const container = document.getElementById('watchlist-action-container');
    if (!container || !state.user) {
        container.innerHTML = ''; // Clear the button if user is logged out
        return;
    }
    const isInWatchlist = state.user.wishlist.includes(ticker);
    container.innerHTML = `<button class="btn btn-link p-2" onclick="toggleWatchlist('${ticker}')"><i class="bi ${isInWatchlist ? 'bi-star-fill text-brand-amber' : 'bi-star'} fs-4"></i></button>`;
}

function getMockCandleData(seedKey, basePrice, range = '1Y') {
    let seed = 0;
    for (let i = 0; i < seedKey.length; i++) {
        seed = (seed * 31 + seedKey.charCodeAt(i)) & 0xffffffff;
    }
    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    const candles = { c: [], t: [] };
    let currentPrice = basePrice * (1 + (random() - 0.7) * 0.3);
    const now = new Date();
    
    let days;
    switch(range) {
        case '1D': days = 1; break;
        case '1W': days = 7; break;
        case '1M': days = 30; break;
        case '1Y':
        default: days = 365; break;
    }

    for (let i = days; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        candles.t.push(date.getTime() / 1000);
        currentPrice *= (1 + (random() - 0.495) * 0.05); 
        candles.c.push(currentPrice);
    }
    candles.c[candles.c.length - 1] = basePrice;
    candles.s = 'ok';
    return candles;
}

async function updateStockChart(range) {
    const chartContainer = document.getElementById('mainStockChart')?.parentElement;
    if (!chartContainer) return;

    const canvasEl = document.getElementById('mainStockChart');
    if (state.chartInstances.main) {
        state.chartInstances.main.destroy();
    }
    
    const candles = getMockCandleData(state.currentStock, state.currentStockPrice, range);
    
    const isPositive = candles.c[candles.c.length - 1] >= candles.c[0];
    const borderColor = isPositive ? '#22c55e' : '#ef4444';
    const gradient = canvasEl.getContext('2d').createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, isPositive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    state.chartInstances.main = new Chart(canvasEl.getContext('2d'), {
        type: 'line',
        data: {
            labels: candles.t.map(t => new Date(t * 1000)),
            datasets: [{ data: candles.c, borderColor: borderColor, borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true, backgroundColor: gradient }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrency(context.parsed.y);
                        }
                    }
                }
            }, 
            scales: { x: { type: 'time', display: false }, y: { display: false } } 
        }
    });
}


async function openTradeModal(ticker, action) {
    if (!state.user) {
        showAppToast("Please log in to trade stocks.", "warning");
        showAuthSubPage('login-page');
        return;
    }
    const quote = await getQuote(ticker);
    if (!quote) { console.error("Could not fetch price."); return; }
    document.getElementById('trade-ticker').value = ticker;
    document.getElementById('trade-action').value = action;
    document.getElementById('trade-price').value = quote.c;
    const sharesOwned = state.user.portfolio.find(h => h.ticker === ticker)?.shares || 0;
    
    const currentPriceEl = document.getElementById('modal-current-price');
    currentPriceEl.dataset.usdValue = quote.c;
    currentPriceEl.classList.add('currency-display');
    currentPriceEl.innerText = formatCurrency(quote.c);

    document.getElementById('modal-shares-owned').textContent = `${sharesOwned} shares`;
    
    const availableCashEl = document.getElementById('modal-available-cash');
    availableCashEl.dataset.usdValue = state.user.cash;
    availableCashEl.classList.add('currency-display');
    availableCashEl.innerText = formatCurrency(state.user.cash);
    
    const confirmBtn = document.getElementById('confirm-trade-btn');
    confirmBtn.className = `btn ${action === 'buy' ? 'btn-brand-green' : 'btn-brand-red'}`;
    confirmBtn.innerText = `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`;

    state.tradeModal.show();
}

async function handleTrade(event) {
    event.preventDefault();
    if (!state.user) return;

    const ticker = document.getElementById('trade-ticker').value;
    const action = document.getElementById('trade-action').value;
    const shares = parseInt(document.getElementById('trade-shares').value);
    const price = parseFloat(document.getElementById('trade-price').value);
    if (isNaN(shares) || shares <= 0) { showAppToast("Please enter a valid number of shares.", "error"); return; }
    
    const userRef = db.collection('users').doc(state.user.uid);

    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) throw new Error("User not found.");
            
            const userData = userDoc.data();
            const newPortfolio = [...userData.portfolio];
            let newCash = userData.cash;

            if (action === 'buy') {
                const cost = shares * price;
                if (cost > newCash) throw new Error("Insufficient funds.");
                newCash -= cost;
                const holding = newPortfolio.find(h => h.ticker === ticker);
                if (holding) { holding.shares += shares; } else { newPortfolio.push({ ticker, shares }); }
            } else {
                const holding = newPortfolio.find(h => h.ticker === ticker);
                if (!holding || shares > holding.shares) throw new Error("You cannot sell more shares than you own.");
                newCash += shares * price;
                holding.shares -= shares;
            }
            const finalPortfolio = newPortfolio.filter(h => h.shares > 0);
            transaction.update(userRef, { portfolio: finalPortfolio, cash: newCash });
        });

        showAppToast(`Trade successful!`, 'success');
        state.tradeModal.hide();
    } catch (error) {
        console.error("Trade failed:", error);
        showAppToast(error.message, 'error');
    }
}

async function toggleWatchlist(ticker) {
    if (!state.user) {
        showAppToast('Please log in to manage your wishlist.', 'warning');
        return;
    }
    const userRef = db.collection('users').doc(state.user.uid);
    const currentWatchlist = state.user.wishlist || [];
    let newWatchlist;
    const index = currentWatchlist.indexOf(ticker);

    if (index > -1) {
        newWatchlist = currentWatchlist.filter(t => t !== ticker);
        showAppToast(`${ticker} removed from your wishlist.`, 'info');
    } else {
        newWatchlist = [...currentWatchlist, ticker];
        showAppToast(`${ticker} added to your wishlist!`, 'success');
    }
    await userRef.update({ wishlist: newWatchlist });
}

async function handleSearchInput(event) {
    const query = event.target.value;
    const resultsContainer = document.getElementById('search-results');
    if (query.length < 1) { resultsContainer.innerHTML = ''; return; }
    const searchData = await searchSymbols(query);
    if (!searchData || !searchData.result) { resultsContainer.innerHTML = '<p class="text-secondary p-2">No results</p>'; return; }
    resultsContainer.innerHTML = searchData.result.filter(item => !item.symbol.includes('.')).map(stock => `
        <a href="#" class="list-group-item list-group-item-action" onclick="event.preventDefault(); state.searchModal.hide(); showStockDetail('${stock.symbol}');">
            <strong>${stock.symbol}</strong> <span class="text-secondary small">${stock.description}</span>
        </a>`).join('');
}


// --- DOMContentLoaded LISTENER ---
document.addEventListener('DOMContentLoaded', async () => {
    state.searchModal = new bootstrap.Modal(document.getElementById('searchModal'));
    state.tradeModal = new bootstrap.Modal(document.getElementById('tradeModal'));
    state.appToast = new bootstrap.Toast(document.getElementById('app-toast'));

    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.bsTheme = savedTheme;

    // Fetch exchange rates on startup
    await fetchExchangeRates();

    // Detect location via IP and store it globally for registration
    detectUserLocation().then(loc => {
        userLocation = loc;
        if (loc) {
            const country = loc.split(', ')[1] || loc;
            document.getElementById('market-country').innerText = country;
        }
    });

    document.getElementById('lets-go-btn').addEventListener('click', () => showAuthSubPage('login-page'));
    document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); showAuthSubPage('register-page'); });
    document.getElementById('show-login-from-register').addEventListener('click', (e) => { e.preventDefault(); showAuthSubPage('login-page'); });
    document.getElementById('upgrade-to-pro-btn').addEventListener('click', () => showMainContent('pro-content'));


    document.getElementById('login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await handleLogin(email, password);
    });

    document.getElementById('register-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        // Pass the detected location to the register function
        await handleRegister(email, password, name, userLocation);
    });

    document.querySelectorAll('.nav-link').forEach(link => {
		link.addEventListener('click', e => {
			e.preventDefault();
			if(link.dataset.target) showMainContent(link.dataset.target);
		});
	});

    document.getElementById('trade-form').addEventListener('submit', handleTrade);
    document.getElementById('add-to-cart-btn').addEventListener('click', handleAddToCart);
    document.getElementById('search-input').addEventListener('input', handleSearchInput);

    // **MODIFIED** Currency change handler
    document.getElementById('currency-menu').addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            const newCurrency = e.target.dataset.currency;
            handleCurrencyChange(newCurrency);
        }
    });

    auth.onAuthStateChanged(user => {
        if (user) {
            initializeMainApp(user);
        } else {
            if (state.userUnsubscribe) state.userUnsubscribe();
            if (state.cartUnsubscribe) state.cartUnsubscribe();
            
            const preservedState = {
                searchModal: state.searchModal,
                tradeModal: state.tradeModal,
                appToast: state.appToast,
                exchangeRates: state.exchangeRates,
            };

            state = { ...initialState, ...preservedState };
            
            document.getElementById('currency-selector').innerText = 'USD';

            initializeGuestApp();
            navigateToPage('welcome-page');
        }
    });
});
