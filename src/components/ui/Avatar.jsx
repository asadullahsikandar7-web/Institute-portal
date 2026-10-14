function initials(name = "") {
  return name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Avatar({ name, size = 36, img }) {
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {img ? <img src={img} alt={name} /> : initials(name)}
    </div>
  );
}
