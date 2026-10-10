import React, { useEffect, useRef, useState } from "react";
import { apiRequest, normalizeProducts } from '../api/api';
import { formatCurrency } from "../utils/format";

function ProductSearch({ onAddToCart, refreshKey = 0 }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(false); // a result list is on screen
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchProducts = async (searchTerm) => {
    setLoading(true);
    setError("");

    try {
      const endpoint = searchTerm
        ? `/products?search=${encodeURIComponent(searchTerm)}`
        : "/products";
      const data = await apiRequest(endpoint);
      if (!mountedRef.current) return;
      setResults(normalizeProducts(data));
      setFetched(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setError((searchTerm ? "Search failed: " : "Failed to load products: ") + err.message);
      setResults([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // POS bumps refreshKey after a successful checkout — refetch the current
  // list so stock values reflect the sale.
  useEffect(() => {
    if (refreshKey > 0 && fetched) {
      fetchProducts(query.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    fetchProducts(query.trim());
  };

  const loadAllProducts = () => fetchProducts("");

  return (
    <div className="product-search">
      <h3>Product Search</h3>
      <form onSubmit={handleSearch}>
        <div className="form-group">
          <label htmlFor="product-search-input">Product name or barcode</label>
          <input
            id="product-search-input"
            type="text"
            placeholder="Search products by name or scan barcode"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
        <button type="button" onClick={loadAllProducts} disabled={loading}>
          Show All Products
        </button>
      </form>

      {error && <div className="error-message">{error}</div>}

      {results.length > 0 ? (
        <ul>
          {results.map(product => (
            <li key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <div>Price: {formatCurrency(product.price)}</div>
                <div>Stock: {product.stock}</div>
                {product.sku && <div>SKU: {product.sku}</div>}
              </div>
              <button
                onClick={() => onAddToCart(product)}
                disabled={product.stock <= 0}
              >
                {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !loading && fetched && (
          <p className="empty-state">
            No products found{query.trim() ? ` for "${query.trim()}"` : ""}.
          </p>
        )
      )}
    </div>
  );
}

export default ProductSearch;
