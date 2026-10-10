import React, { useCallback, useState } from "react";
import ProductSearch from "../components/ProductSearch";
import Cart from "../components/Cart";

function POS() {
  const [cart, setCart] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddToCart = useCallback((product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const alreadyInCart = existing ? existing.quantity : 0;
      // Never add more than the product's available stock.
      if (product.stock != null && alreadyInCart >= product.stock) {
        return prev;
      }
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const handleRemove = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const handleProcessPayment = useCallback(() => {
    // Bump the key so ProductSearch refetches fresh stock values.
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <div>
      <h2>Point of Sale System</h2>
      <div className="pos-layout">
        <div>
          <ProductSearch onAddToCart={handleAddToCart} refreshKey={refreshKey} />
        </div>
        <div>
          <Cart
            cart={cart}
            onRemove={handleRemove}
            onProcessPayment={handleProcessPayment}
            setCart={setCart}
          />
        </div>
      </div>
    </div>
  );
}

export default POS;
