// --- SHOPPING CART LOGIC ---

/**
 * Gets the correct ID for cart operations (userId or sessionId).
 * @returns {string|null} The ID for the cart.
 */
function getCartId() {
    return state.user ? state.user.uid : state.sessionId;
}

/**
 * Renders the shopping cart page content.
 */
async function renderShoppingCartPage() {
    const id = getCartId();
    const container = document.getElementById('cart-content');
    if (!id || !container) return;

    const cartRef = db.collection("carts").doc(id);
    
    // Use onSnapshot for real-time updates
    state.cartUnsubscribe = cartRef.onSnapshot(async (doc) => {
        const cart = doc.exists ? doc.data() : { items: [] };
        
        if (!cart || cart.items.length === 0) {
            container.innerHTML = `<h2 class="h3 fw-bold mb-4">Shopping Cart</h2><p class="text-secondary text-center p-5">Your cart is empty.</p>`;
            return;
        }

        const quotes = await Promise.all(cart.items.map(item => getQuote(item.ticker)));
        
        let total = 0;
        let itemsHtml = cart.items.map((item, index) => {
            const quote = quotes[index];
            const currentPrice = quote ? quote.c : item.price; // Use live price if available
            const itemTotal = currentPrice * item.shares;
            total += itemTotal;

            // Add data attributes and classes for currency conversion
            return `
                <div class="cart-item">
                    <div>
                        <h5 class="fw-bold">${item.ticker}</h5>
                        <p class="mb-0 text-secondary">
                            <input type="number" value="${item.shares}" min="1" class="form-control form-control-sm cart-item-shares" data-ticker="${item.ticker}" style="width: 70px; display: inline-block;">
                            shares @ <span class="currency-display" data-usd-value="${currentPrice}">${formatCurrency(currentPrice)}</span>
                        </p>
                    </div>
                    <div class="d-flex align-items-center">
                        <h5 class="fw-bold me-3 mb-0 currency-display" data-usd-value="${itemTotal}">${formatCurrency(itemTotal)}</h5>
                        <button class="btn btn-sm btn-outline-danger remove-from-cart-btn" data-ticker="${item.ticker}"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <h2 class="h3 fw-bold mb-4">Shopping Cart</h2>
            <div class="card bg-body-tertiary border-0 rounded-4 p-2">
                ${itemsHtml}
            </div>
            <div class="card bg-body-tertiary border-0 p-3 mt-4">
                 <div class="d-flex justify-content-between align-items-center">
                    <h4>Total:</h4>
                    <h4 id="cart-total" class="text-brand-green currency-display" data-usd-value="${total}">${formatCurrency(total)}</h4>
                </div>
                <hr>
                <button id="checkout-btn" class="btn btn-brand-green btn-lg w-100" ${cart.items.length === 0 || !state.user ? 'disabled' : ''}>${state.user ? 'Checkout' : 'Log In to Checkout'}</button>
            </div>
        `;

        // Add event listeners after rendering
        addCartEventListeners();
    }, error => {
        console.error("Error listening to cart:", error);
    });
}

/**
 * Adds event listeners for cart interactions.
 */
function addCartEventListeners() {
    const id = getCartId();
    document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const ticker = e.currentTarget.dataset.ticker;
            removeFromCart(id, ticker);
        });
    });

    document.querySelectorAll('.cart-item-shares').forEach(input => {
        input.addEventListener('change', (e) => {
            const ticker = e.currentTarget.dataset.ticker;
            const newShares = parseInt(e.currentTarget.value);
            updateCartItem(id, ticker, newShares);
        });
    });

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }
}


/**
 * Adds an item to the shopping cart in Firestore.
 */
async function handleAddToCart() {
    const id = getCartId();
    if (!id) {
        showAppToast("Cannot add to cart. Please refresh.", 'error');
        return;
    }

    const ticker = document.getElementById('trade-ticker').value;
    const shares = parseInt(document.getElementById('trade-shares').value);
    const price = parseFloat(document.getElementById('trade-price').value);

    if (isNaN(shares) || shares <= 0) {
        showAppToast("Please enter a valid number of shares.", 'error');
        return;
    }

    const item = { ticker, shares, price };
    const cartRef = db.collection('carts').doc(id);
    
    await db.runTransaction(async (transaction) => {
        const cartDoc = await transaction.get(cartRef);
        if (!cartDoc.exists) {
            transaction.set(cartRef, { items: [item] });
        } else {
            const cartData = cartDoc.data();
            const existingItemIndex = cartData.items.findIndex(i => i.ticker === item.ticker);
            if (existingItemIndex > -1) {
                cartData.items[existingItemIndex].shares += shares;
            } else {
                cartData.items.push(item);
            }
            transaction.update(cartRef, { items: cartData.items });
        }
    });
    
    showAppToast(`${shares} share(s) of ${ticker} added to cart!`);
    state.tradeModal.hide();
}

/**
 * Removes an item from the cart.
 * @param {string} id - The cart ID.
 * @param {string} ticker - The stock ticker to remove.
 */
async function removeFromCart(id, ticker) {
    const cartRef = db.collection('carts').doc(id);
    await db.runTransaction(async (transaction) => {
        const cartDoc = await transaction.get(cartRef);
        if (!cartDoc.exists) return;
        const newItems = cartDoc.data().items.filter(i => i.ticker !== ticker);
        transaction.update(cartRef, { items: newItems });
    });
    showAppToast(`${ticker} removed from cart.`);
}

/**
 * Updates the number of shares for an item in the cart.
 * @param {string} id - The cart ID.
 * @param {string} ticker - The stock ticker to update.
 * @param {number} newShares - The new quantity of shares.
 */
async function updateCartItem(id, ticker, newShares) {
    if (newShares <= 0) {
        await removeFromCart(id, ticker);
        return;
    }
    const cartRef = db.collection('carts').doc(id);
    await db.runTransaction(async (transaction) => {
        const cartDoc = await transaction.get(cartRef);
        if (!cartDoc.exists) return;
        const cartData = cartDoc.data();
        const itemIndex = cartData.items.findIndex(i => i.ticker === ticker);
        if (itemIndex > -1) {
            cartData.items[itemIndex].shares = newShares;
            transaction.update(cartRef, { items: cartData.items });
        }
    });
}

/**
 * Merges the session cart with the user's cart upon login.
 * @param {string} sessionId - The session cart ID.
 * @param {string} userId - The user's cart ID.
 */
async function mergeSessionCart(sessionId, userId) {
    const sessionCartRef = db.collection('carts').doc(sessionId);
    const userCartRef = db.collection('carts').doc(userId);

    const sessionCartDoc = await sessionCartRef.get();
    if (!sessionCartDoc.exists || sessionCartDoc.data().items.length === 0) {
        return; // No session cart to merge
    }

    const sessionItems = sessionCartDoc.data().items;

    await db.runTransaction(async (transaction) => {
        const userCartDoc = await transaction.get(userCartRef);
        if (!userCartDoc.exists) {
            transaction.set(userCartRef, { items: sessionItems });
        } else {
            const userItems = userCartDoc.data().items;
            sessionItems.forEach(sessionItem => {
                const userItemIndex = userItems.findIndex(i => i.ticker === sessionItem.ticker);
                if (userItemIndex > -1) {
                    userItems[userItemIndex].shares += sessionItem.shares;
                } else {
                    userItems.push(sessionItem);
                }
            });
            transaction.update(userCartRef, { items: userItems });
        }
        transaction.delete(sessionCartRef); // Delete session cart after merging
    });

    localStorage.removeItem('sessionId');
    showAppToast("Your guest cart has been merged.");
}


/**
 * Handles the checkout process.
 */
async function handleCheckout() {
    const id = getCartId();
    if (!state.user) {
        showAppToast("Please log in to check out.", 'error');
        navigateToPage('auth-container');
        return;
    }

    const cartRef = db.collection('carts').doc(id);
    const userRef = db.collection('users').doc(state.user.uid);

    const cartDoc = await cartRef.get();
    if (!cartDoc.exists || cartDoc.data().items.length === 0) {
        showAppToast("Your cart is empty.", 'error');
        return;
    }
    const cart = cartDoc.data();

    // Fetch live prices for checkout
    const quotes = await Promise.all(cart.items.map(item => getQuote(item.ticker)));
    const totalCost = cart.items.reduce((acc, item, index) => {
        const livePrice = quotes[index] ? quotes[index].c : item.price;
        return acc + (livePrice * item.shares);
    }, 0);

    await db.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data();

        if (totalCost > userData.cash) {
            throw new Error("Insufficient funds to complete purchase.");
        }

        const newPortfolio = [...userData.portfolio];
        cart.items.forEach(item => {
            const existingHolding = newPortfolio.find(h => h.ticker === item.ticker);
            if (existingHolding) {
                existingHolding.shares += item.shares;
            } else {
                newPortfolio.push({ ticker: item.ticker, shares: item.shares });
            }
        });

        const newCash = userData.cash - totalCost;

        transaction.update(userRef, { cash: newCash, portfolio: newPortfolio });
        transaction.delete(cartRef); // Clear cart
    }).then(() => {
        showAppToast("Purchase successful! Your portfolio has been updated.", 'success');
    }).catch(error => {
        console.error("Checkout failed:", error);
        showAppToast(error.message, 'error');
    });
}
