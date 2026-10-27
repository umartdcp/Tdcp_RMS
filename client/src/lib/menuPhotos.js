export const DEFAULT_MENU_PHOTOS = {
  "Beef Burger": "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80",
  "Beef Pulao": "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&q=80",
  "Chicken Biryani": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&q=80",
  "Chicken Broast": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=600&q=80",
  "Chicken Corn Soup": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  "Chicken Karahi": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80",
  "Chicken Tikka": "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600&q=80",
  "Club Sandwich": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=600&q=80",
  "Cold Drink": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&q=80",
  "Daal Mash": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&q=80",
  "French Fries": "https://images.unsplash.com/photo-1573080494122-9ba29ce8d3f0?w=600&q=80",
  "Fry Eggs": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&q=80",
  "Garlic Naan": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  "Gulab Jamun": "https://images.unsplash.com/photo-1457518919282-b199744eefd8?w=600&q=80",
  "Hot Coffee": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
  Kheer: "https://images.unsplash.com/photo-1488477182946-bb92d54389dd?w=600&q=80",
  "Mango Lassi": "https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=600&q=80",
  Paratha: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  "Seekh Kabab": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=80",
};

export function mediaUrl(url) {
  const value = String(url || "");
  if (!value.startsWith("/uploads")) return value;
  if (typeof window === "undefined") return value;
  const configured = window.tdcpDesktop?.apiBase;
  if (!configured) return value;
  return `${String(configured).replace(/\/api\/?$/, "")}${value}`;
}

export function menuPhoto(item) {
  return mediaUrl(item?.image_url || DEFAULT_MENU_PHOTOS[item?.name] || DEFAULT_MENU_PHOTOS["Chicken Karahi"]);
}
