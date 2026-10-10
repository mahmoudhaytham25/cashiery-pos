import React, { useState, useEffect, useRef } from "react";
import { apiRequest, normalizeProducts } from "../api/api";
import { formatCurrency } from "../utils/format";

const EMPTY_FORM = { name: "", price: "", stock: "", SKU: "" };

function ProductManagement({ onProductChange }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    fetchProducts();
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss transient success messages.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // Revert "Confirm?" delete buttons after a few seconds.
  useEffect(() => {
    if (confirmDeleteId == null) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/products");
      if (!mountedRef.current) return;
      const sortedProducts = normalizeProducts(data).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setProducts(sortedProducts);
    } catch (err) {
      if (!mountedRef.current) return;
      setError("Failed to fetch products: " + err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setMessage("");

    const name = form.name.trim();
    const price = parseFloat(form.price);
    const stock = parseInt(form.stock, 10);

    if (!name) {
      setError("Product name is required.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be a valid non-negative number.");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a whole number (0 or greater).");
      return;
    }

    setSubmitting(true);
    try {
      const productData = {
        name,
        price,
        stock,
        SKU: form.SKU.trim() === "" ? null : form.SKU.trim()
      };

      if (editingId) {
        await apiRequest(`/products/${editingId}`, "PUT", productData);
        setMessage("Product updated successfully.");
        setEditingId(null);
      } else {
        await apiRequest("/products", "POST", productData);
        setMessage("Product added successfully.");
      }

      setForm(EMPTY_FORM);
      await fetchProducts();
      if (onProductChange) onProductChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (product) => {
    setForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      SKU: product.sku || ""
    });
    setEditingId(product.id);
    setError("");
    setMessage("");
  };

  const handleDelete = async (id) => {
    // Inline confirm: first click turns the button into "Confirm?".
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    setError("");
    setMessage("");

    try {
      await apiRequest(`/products/${id}`, "DELETE");
      if (id === editingId) cancelEdit();
      setMessage("Product deleted.");
      await fetchProducts();
      if (onProductChange) onProductChange();
    } catch (err) {
      setError("Failed to delete product: " + err.message);
    }
  };

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  if (loading && products.length === 0) {
    return <div>Loading products...</div>;
  }

  return (
    <div className="product-management">
      <h3>Product Management</h3>

      <form onSubmit={handleSubmit} className="product-form">
        <div className="form-group">
          <label htmlFor="pm-name">Product Name</label>
          <input
            id="pm-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="pm-price">Price</label>
          <input
            id="pm-price"
            name="price"
            value={form.price}
            onChange={handleChange}
            required
            type="number"
            step="0.01"
            min="0"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="pm-stock">Stock Quantity</label>
          <input
            id="pm-stock"
            name="stock"
            value={form.stock}
            onChange={handleChange}
            required
            type="number"
            step="1"
            min="0"
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="pm-sku">SKU (optional)</label>
          <input
            id="pm-sku"
            name="SKU"
            value={form.SKU}
            onChange={handleChange}
            className="form-input"
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting
              ? "Saving..."
              : editingId ? "Update Product" : "Add Product"}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit} className="cancel-btn">
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="product-list">
        <h4>Current Products ({products.length})</h4>
        {products.length === 0 ? (
          <p className="no-products">No products found.</p>
        ) : (
          <ul className="products">
            {products.map(product => (
              <li key={product.id} className="product-item">
                <div className="product-info">
                  <strong className="product-name">{product.name}</strong>
                  <div className="product-detail">Price: {formatCurrency(product.price)}</div>
                  <div className={`product-detail ${product.stock < 10 ? 'low-stock' : ''}`}>
                    Stock: {product.stock}
                  </div>
                  {product.sku && (
                    <div className="product-detail">SKU: {product.sku}</div>
                  )}
                </div>
                <div className="product-actions">
                  <button
                    onClick={() => handleEdit(product)}
                    className="edit-btn"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className={`delete-btn ${confirmDeleteId === product.id ? 'confirm' : ''}`}
                  >
                    {confirmDeleteId === product.id ? "Confirm?" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ProductManagement;
