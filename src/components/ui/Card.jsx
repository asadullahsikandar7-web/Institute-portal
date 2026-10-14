import { forwardRef } from "react";

// forwardRef is additive — every existing call site that doesn't pass a
// ref behaves exactly as before; this only enables the few that need the
// underlying DOM node directly (e.g. ClassCallRoom's Fullscreen API target).
const Card = forwardRef(function Card({ children, style = {}, className = "", onClick }, ref) {
  return (
    <div ref={ref} className={"card " + className} style={style} onClick={onClick}>
      {children}
    </div>
  );
});

export default Card;
