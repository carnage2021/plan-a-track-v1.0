import type { SamplePhoto } from "./types";

// Free photos from Wikimedia Commons that every account starts with: staff uniforms (the dress, never the people),
// cutlery and decoration. Named like the starter staff roles and cutlery items, so each shows beside its line in
// Step 3. Used by signup (server) and by "Add starter photos" (browser).

const commons = (path: string) => `https://thumb.wikimedia.org/wikipedia/commons/thumb/${path}/960px-${path.split("/").pop()}`;

export const starterPhotos: Omit<SamplePhoto, "id">[] = [
  { kind: "staff", name: "Waiter", photoUrl: commons("9/92/Waistcoat.jpg"), note: "Waistcoat over a white shirt" },
  { kind: "staff", name: "Cook", photoUrl: commons("5/5e/Chef_coat_and_women%27s_jacket_edited.jpg"), note: "White chef coat" },
  { kind: "staff", name: "Supervisor", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/38/Kurta_churidar_nehru_vest.jpg", note: "Kurta with a Nehru jacket" },
  { kind: "cutlery", name: "Dinner plate", photoUrl: commons("e/ee/Thali_steel.JPG"), note: "Steel thali with katoris" },
  { kind: "cutlery", name: "Chafing dish", photoUrl: commons("a/a5/Chafing_dish.jpg"), note: "Steel chafing dish for the buffet" },
  { kind: "cutlery", name: "Spoon", photoUrl: commons("1/13/Stainless_steel_spoon.jpg"), note: "Stainless steel spoon" },
  { kind: "cutlery", name: "Water glass", photoUrl: commons("b/b3/Water_Glass_%286579974749%29.jpg"), note: "Clear glass tumbler" },
  { kind: "decor", name: "Wedding mandap", photoUrl: commons("1/10/Vivah_Mandap%2C_Janakpur.jpg"), note: "Traditional vivah mandap" },
  { kind: "decor", name: "Mandap ceiling", photoUrl: commons("d/df/View_of_roof_of_a_Marwa_%28mandap%29.jpg"), note: "Draped marwa roof" },
  { kind: "decor", name: "Flower stage", photoUrl: commons("d/d8/Wedding_Stage.jpg"), note: "Stage framed with fresh flowers" },
  { kind: "decor", name: "Entrance gate", photoUrl: commons("9/99/Wedding_Decoration_of_a_Banquet_Hall.jpg"), note: "Flower and drape entrance with lights" },
  { kind: "decor", name: "Reception backdrop", photoUrl: commons("1/1b/Wedding_reception_stage%2C_decorations%2C_Kochi.jpg"), note: "White drapes, fairy lights and a flower ring" },
  { kind: "decor", name: "Flower rangoli", photoUrl: commons("6/6d/Flower_Rangoli_with_Traditional_Lamp.jpg"), note: "Petal rangoli around a brass lamp" },
];
