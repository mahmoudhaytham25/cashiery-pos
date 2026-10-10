import React from "react";
import { formatCurrency } from "../utils/format";

export const LOW_STOCK_THRESHOLD = 10;

function ProductInfo({ product, lowStock = false }) {
  return (
    <div className="product-info">
      <strong className="product-name">
        {product.name}
        {lowStock && <span className="low-stock">Low stock</span>}
      </strong>
      <div className="product-detail">
        {formatCurrency(product.price)} · {product.stock} in stock
        {product.sku && (
          <span className="product-sku"> · {product.sku}</span>
        )}
      </div>
    </div>
  );
}

export default ProductInfo;
