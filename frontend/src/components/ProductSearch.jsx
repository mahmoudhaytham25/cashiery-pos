import React, { useCallback, useEffect, useState } from "react";
import { normalizeProducts } from '../api/api';
import { useApiCall } from "../hooks/useFetch";
import FormField from "./FormField";
import ProductInfo from "./ProductInfo";
import StatusMessage from "./StatusMessage";

function ProductSearch({ onAddToCart, refreshKey = 0 }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [fetched, setFetched] = useState(false); // a result list is on screen
  const { run, loading } = useApiCall();

  const fetchProducts = useCallback(async (searchTerm) => {
    setError("");

    try {
      const endpoint = searchTerm
        ? `/products?search=${encodeURIComponent(searchTerm)}`
        : "/products";
      const data = await run(endpoint);
      if (data === undefined) return; // superseded by a newer request
      setResults(normalizeProducts(data));
      setFetched(true);
    } catch (err) {
      setError((searchTerm ? "Search failed: " : "Failed to load products: ") + err.message);
      setResults([]);
    }
  }, [run]);

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
        <FormField
          id="product-search-input"
          label="Product name or barcode"
          placeholder="Search products by name or scan barcode"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
        <button type="button" onClick={loadAllProducts} disabled={loading}>
          Show All Products
        </button>
      </form>

      {error && <StatusMessage type="error">{error}</StatusMessage>}

      {results.length > 0 ? (
        <ul>
          {results.map(product => (
            <li key={product.id}>
              <ProductInfo product={product} />
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

export default React.memo(ProductSearch);
