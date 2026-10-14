// variant: primary | accent | ghost | danger
export default function Btn({ children, variant = "primary", onClick, disabled, style = {}, type = "button", full }) {
  return (
    <button
      type={type}
      className={"btn btn-" + variant}
      disabled={disabled}
      onClick={onClick}
      style={{ ...(full ? { width: "100%", justifyContent: "center" } : {}), ...style }}
    >
      {children}
    </button>
  );
}
