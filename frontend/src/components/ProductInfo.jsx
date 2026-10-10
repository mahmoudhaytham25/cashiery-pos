import React from "react";
import { formatCurrency } from "../utils/format";

export const LOW_STOCK_THRESHOLD = 10;

function ProductInfo({ product, lowStock = false }) {
  return (
    <div className="product-info">
      <strong className="product-name">{product.name}</strong>
      <div className="product-detail">Price: {formatCurrency(product.price)}</div>
      <div className={`product-detail ${lowStock ? "low-stock" : ""}`}>
        Stock: {product.stock}
      </div>
      {product.sku && <div className="product-detail">SKU: {product.sku}</div>}
    </div>
  );
}

export default ProductInfo;
