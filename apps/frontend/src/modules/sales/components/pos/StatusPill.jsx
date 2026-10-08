import React from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

/**
 * StatusPill - Accessible hardware & connectivity status indicator
 * @param {Object} props
 * @param {string} props.label - Indicator name (e.g. "Network", "Printer")
 * @param {boolean|string} props.isOk - Whether the status is healthy
 * @param {string} [props.okText="Connected"] - Text when healthy
 * @param {string} [props.errorText="Disconnected"] - Text when failed
 * @param {React.ReactNode} [props.icon] - Leading icon
 * @param {Function} [props.onClick] - Optional click handler for diagnostics
 * @param {string} [props.tooltip] - Optional tooltip text
 */
export const StatusPill = React.memo(function StatusPill({
  label,
  isOk = true,
  okText = 'Online',
  errorText = 'Offline',
  icon = null,
  onClick = null,
  tooltip = ''
}) {
  const healthy = Boolean(isOk);
  const statusText = healthy ? okText : errorText;
  const isClickable = typeof onClick === 'function';

  const content = (
    <>
      <span className="pos-status-pill__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="pos-status-pill__dot-wrapper" aria-hidden="true">
        <span
          className={`pos-status-pill__dot ${
            healthy ? 'pos-status-pill__dot--ok' : 'pos-status-pill__dot--err'
          }`}
        />
        {healthy ? (
          <Check className="pos-status-pill__symbol pos-status-pill__symbol--ok" />
        ) : (
          <X className="pos-status-pill__symbol pos-status-pill__symbol--err" />
        )}
      </span>
      <span className="pos-status-pill__text">
        <strong className="pos-status-pill__label">{label}:</strong>{' '}
        <span className={healthy ? 'pos-text-ok' : 'pos-text-err'}>
          {statusText}
        </span>
      </span>
    </>
  );

  const containerProps = {
    className: `pos-status-pill ${
      healthy ? 'pos-status-pill--healthy' : 'pos-status-pill--faulty'
    } ${isClickable ? 'pos-status-pill--interactive' : ''}`,
    title: tooltip || `${label}: ${statusText}`,
    'aria-label': `${label}: ${statusText}`
  };

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        {...containerProps}
      >
        {content}
      </button>
    );
  }

  return (
    <div role="status" {...containerProps}>
      {content}
    </div>
  );
});

export default StatusPill;
