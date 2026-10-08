import React from 'react';
import { Utensils, ShoppingBag, Truck } from 'lucide-react';

/**
 * OrderTypeSelector - Accessible Segmented Control for POS Order Fulfillment Modes
 * @param {Object} props
 * @param {("dine-in"|"takeaway"|"delivery")} [props.value="takeaway"]
 * @param {Function} [props.onChange]
 * @param {boolean} [props.disabled=false]
 */
export const OrderTypeSelector = React.memo(function OrderTypeSelector({
  value = 'takeaway',
  onChange,
  disabled = false
}) {
  const options = [
    { id: 'dine-in', label: 'Dine-In', icon: Utensils },
    { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
    { id: 'delivery', label: 'Delivery', icon: Truck }
  ];

  return (
    <div
      className="pos-order-type-selector"
      role="group"
      aria-label="Order Fulfillment Type Selector"
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange && onChange(opt.id)}
            className={`pos-order-type-btn ${
              isActive ? 'pos-order-type-btn--active' : ''
            }`}
          >
            <Icon className="pos-order-type-btn__icon" aria-hidden="true" />
            <span className="pos-order-type-btn__label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
});

export default OrderTypeSelector;
