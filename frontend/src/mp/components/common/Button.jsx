import React from 'react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  icon: Icon = null
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs focus:ring-indigo-500',
    secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs focus:ring-slate-400',
    outline: 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 focus:ring-slate-400',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5'
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
    </button>
  );
};
