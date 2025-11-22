class CartComplementaryProducts extends HTMLElement {
  constructor() {
    super();
    this.productId = this.dataset.productId;
    this.limit = this.dataset.limit || 4;
    this.url = this.dataset.url;
    
    if (this.productId) {
      this.loadRecommendations();
    }
  }

  async loadRecommendations() {
    try {
      const response = await fetch(this.url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }
      
      const data = await response.json();
      
      if (data.products && data.products.length > 0) {
        this.renderProducts(data.products);
      } else {
        this.hideSection();
      }
    } catch (error) {
      console.error('Error loading complementary products:', error);
      this.hideSection();
    }
  }

  renderProducts(products) {
    const container = this.querySelector('.cart-complementary__products');
    const loading = this.querySelector('.cart-complementary__loading');
    
    if (!container) return;
    
    // Hide loading spinner
    if (loading) {
      loading.classList.add('hidden');
    }
    
    // Clear existing content
    container.innerHTML = '';
    
    // Render each product
    products.forEach((product) => {
      const productCard = this.createProductCard(product);
      container.appendChild(productCard);
    });
    
    // Show products with fade-in
    container.classList.add('loaded');
  }

  createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'cart-complementary__product-card';
    card.setAttribute('role', 'listitem');
    
    // Get first variant for pricing
    const variant = product.variants[0];
    const hasComparePrice = variant.compare_at_price && variant.compare_at_price > variant.price;
    
    // Format prices
    const price = this.formatMoney(variant.price);
    const comparePrice = hasComparePrice ? this.formatMoney(variant.compare_at_price) : null;
    
    // Get product image
    const imageUrl = product.featured_image 
      ? this.getImageUrl(product.featured_image, '200x200')
      : '';
    
    card.innerHTML = `
      <img 
        src="${imageUrl}" 
        alt="${this.escapeHtml(product.title)}"
        class="cart-complementary__product-image"
        loading="lazy"
        width="80"
        height="80"
      />
      
      <div class="cart-complementary__product-info">
        <h4 class="cart-complementary__product-title">
          <a href="${product.url}" class="cart-complementary__product-link">
            ${this.escapeHtml(product.title)}
          </a>
        </h4>
        <div class="cart-complementary__product-price">
          ${comparePrice ? `<span class="cart-complementary__product-price--compare">${comparePrice}</span>` : ''}
          <span class="cart-complementary__product-price--current">${price}</span>
        </div>
      </div>
      
      <button 
        type="button"
        class="cart-complementary__add-button"
        data-variant-id="${variant.id}"
        aria-label="Add ${this.escapeHtml(product.title)} to cart"
      >
        <span class="svg-wrapper">
          <svg class="icon-plus" aria-hidden="true" focusable="false" role="presentation" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
            <path d="M6 4h4v2H6v4H4V6H0V4h4V0h2v4z" fill="currentColor"/>
          </svg>
        </span>
      </button>
    `;
    
    // Add click handler for add to cart button
    const addButton = card.querySelector('.cart-complementary__add-button');
    addButton.addEventListener('click', (e) => this.handleAddToCart(e, variant.id, product.title));
    
    return card;
  }

  async handleAddToCart(event, variantId, productTitle) {
    const button = event.currentTarget;
    
    // Prevent double-clicks
    if (button.disabled) return;
    
    button.disabled = true;
    button.classList.add('cart-complementary__add-button--loading');
    
    // Show loading spinner
    const originalContent = button.innerHTML;
    button.innerHTML = `
      <div class="loading__spinner">
        <svg aria-hidden="true" focusable="false" role="presentation" class="spinner" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg">
          <circle class="path" fill="none" stroke-width="6" cx="33" cy="33" r="30"></circle>
        </svg>
      </div>
    `;
    
    try {
      const formData = {
        items: [{
          id: variantId,
          quantity: 1
        }]
      };
      
      const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to add to cart');
      }
      
      const data = await response.json();
      
      // Publish cart update event
      if (typeof publish !== 'undefined') {
        publish(PUB_SUB_EVENTS.cartUpdate, {
          source: 'cart-complementary-products',
          productVariantId: variantId,
          cartData: data
        });
      }
      
      // Trigger cart drawer update
      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        // Fetch updated cart drawer content
        const cartResponse = await fetch(`${window.Shopify.routes.root}?section_id=cart-drawer`);
        const html = await cartResponse.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Update cart drawer
        const newDrawerInner = doc.querySelector('.drawer__inner');
        const currentDrawerInner = document.querySelector('.drawer__inner');
        
        if (newDrawerInner && currentDrawerInner) {
          currentDrawerInner.innerHTML = newDrawerInner.innerHTML;
        }
        
        // Update cart icon
        const newCartIcon = doc.querySelector('#cart-icon-bubble');
        const currentCartIcon = document.querySelector('#cart-icon-bubble');
        
        if (newCartIcon && currentCartIcon) {
          currentCartIcon.innerHTML = newCartIcon.innerHTML;
        }
      }
      
      // Show success feedback
      button.innerHTML = `
        <svg class="icon-checkmark" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 9" fill="none">
          <path d="M1 4.5L4 7.5L11 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      
      setTimeout(() => {
        button.innerHTML = originalContent;
        button.disabled = false;
        button.classList.remove('cart-complementary__add-button--loading');
      }, 1500);
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      
      // Restore button
      button.innerHTML = originalContent;
      button.disabled = false;
      button.classList.remove('cart-complementary__add-button--loading');
      
      // Show error message
      alert('Sorry, there was an error adding this item to your cart. Please try again.');
    }
  }

  hideSection() {
    this.classList.add('hidden');
  }

  getImageUrl(url, size) {
    if (!url) return '';
    
    // Shopify CDN image sizing
    const extension = url.split('.').pop();
    return url.replace(`.${extension}`, `_${size}.${extension}`);
  }

  formatMoney(cents) {
    // Basic money formatting - you may want to use Shopify's money format
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('cart-complementary-products', CartComplementaryProducts);
