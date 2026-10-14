import Icon from "./Icon.jsx";

// tone: success | danger | info | warn | neutral | accent
export default function Badge({ tone = "neutral", children, icon }) {
  return (
    <span className={"badge " + tone}>
      {icon && <Icon name={icon} size={11} />}
      {children}
    </span>
  );
}
