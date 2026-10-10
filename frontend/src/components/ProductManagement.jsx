import React, { useState, useEffect, useCallback } from "react";
import { normalizeProducts } from "../api/api";
import { useApiCall } from "../hooks/useFetch";
import { useSubmit } from "../hooks/useSubmit";
import FormField from "./FormField";
import ProductInfo, { LOW_STOCK_THRESHOLD } from "./ProductInfo";
import StatusMessage from "./StatusMessage";

const EMPTY_FORM = { name: "", price: "", stock: "", SKU: "" };

function ProductManagement({ onProductChange }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const { submitting, error, setError, message, setMessage, submit, clear } = useSubmit();
  const { run, loading } = useApiCall();
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await run("/products");
      if (data === undefined) return; // superseded by a newer request
      const sortedProducts = normalizeProducts(data).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      setProducts(sortedProducts);
    } catch (err) {
      setError("Failed to fetch products: " + err.message);
    }
  }, [run, setError]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Auto-dismiss transient success messages.
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message, setMessage]);

  // Revert "Confirm?" delete buttons after a few seconds.
  useEffect(() => {
    if (confirmDeleteId == null) return;
    const timer = setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => clearTimeout(timer);
  }, [confirmDeleteId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    clear();

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

    await submit(async () => {
      const productData = {
        name,
        price,
        stock,
        SKU: form.SKU.trim() === "" ? null : form.SKU.trim()
      };

      if (editingId) {
        if ((await run(`/products/${editingId}`, "PUT", productData)) === undefined) return;
        setMessage("Product updated successfully.");
        setEditingId(null);
      } else {
        if ((await run("/products", "POST", productData)) === undefined) return;
        setMessage("Product added successfully.");
      }

      setForm(EMPTY_FORM);
      await fetchProducts();
      if (onProductChange) onProductChange();
    });
  };

  const handleEdit = (product) => {
    setForm({
      name: product.name,
      price: String(product.price),
      stock: String(product.stock),
      SKU: product.sku || ""
    });
    setEditingId(product.id);
    clear();
  };

  const handleDelete = async (id) => {
    // Inline confirm: first click turns the button into "Confirm?".
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    clear();

    try {
      if ((await run(`/products/${id}`, "DELETE")) === undefined) return;
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
    return (
      <div className="product-management card">
        <p className="empty-state">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="product-management card">
      <h3>Product Management</h3>

      <form onSubmit={handleSubmit} className="product-form">
        <FormField
          id="pm-name"
          label="Product Name"
          name="name"
          value={form.name}
          onChange={handleChange}
          required
          className="form-input"
        />
        <FormField
          id="pm-price"
          label="Price"
          name="price"
          value={form.price}
          onChange={handleChange}
          required
          type="number"
          step="0.01"
          min="0"
          className="form-input"
        />
        <FormField
          id="pm-stock"
          label="Stock Quantity"
          name="stock"
          value={form.stock}
          onChange={handleChange}
          required
          type="number"
          step="1"
          min="0"
          className="form-input"
        />
        <FormField
          id="pm-sku"
          label="SKU (optional)"
          name="SKU"
          value={form.SKU}
          onChange={handleChange}
          className="form-input"
        />
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

      {message && <StatusMessage type="success">{message}</StatusMessage>}
      {error && <StatusMessage type="error">{error}</StatusMessage>}

      <div className="product-list">
        <h4>Current Products ({products.length})</h4>
        {products.length === 0 ? (
          <p className="no-products">No products found.</p>
        ) : (
          <ul className="products scroll-list">
            {products.map(product => (
              <li key={product.id} className="product-item">
                <ProductInfo
                  product={product}
                  lowStock={product.stock < LOW_STOCK_THRESHOLD}
                />
                <div className="product-actions">
                  <button
                    onClick={() => handleEdit(product)}
                    className="edit-btn btn-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className={`delete-btn btn-sm ${confirmDeleteId === product.id ? 'confirm' : ''}`}
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

export default React.memo(ProductManagement);
