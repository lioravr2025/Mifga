export interface City {
  name: string;
  lat: number;
  lng: number;
}

// Major Israeli cities/urban areas with rough center coordinates - good enough
// for scattering seeded markers within a few km, not meant as precise
// municipal boundaries.
export const ISRAELI_CITIES: City[] = [
  { name: "תל אביב-יפו", lat: 32.0853, lng: 34.7818 },
  { name: "ירושלים", lat: 31.7683, lng: 35.2137 },
  { name: "חיפה", lat: 32.794, lng: 34.9896 },
  { name: "ראשון לציון", lat: 31.9642, lng: 34.8044 },
  { name: "פתח תקווה", lat: 32.0878, lng: 34.8878 },
  { name: "אשדוד", lat: 31.8014, lng: 34.6435 },
  { name: "נתניה", lat: 32.3215, lng: 34.8532 },
  { name: "באר שבע", lat: 31.2518, lng: 34.7913 },
  { name: "בני ברק", lat: 32.0807, lng: 34.8338 },
  { name: "חולון", lat: 32.0114, lng: 34.7736 },
  { name: "רמת גן", lat: 32.0684, lng: 34.8248 },
  { name: "רחובות", lat: 31.8928, lng: 34.8113 },
  { name: "בת ים", lat: 32.0171, lng: 34.7502 },
  { name: "אשקלון", lat: 31.6693, lng: 34.5715 },
  { name: "הרצליה", lat: 32.1663, lng: 34.8434 },
  { name: "כפר סבא", lat: 32.175, lng: 34.9068 },
  { name: "מודיעין", lat: 31.8969, lng: 35.0095 },
  { name: "רעננה", lat: 32.1848, lng: 34.8706 },
  { name: "חדרה", lat: 32.4340, lng: 34.9196 },
  { name: "נצרת", lat: 32.6996, lng: 35.3035 },
  { name: "לוד", lat: 31.9516, lng: 34.8964 },
  { name: "רמלה", lat: 31.9276, lng: 34.8625 },
  { name: "גבעתיים", lat: 32.0723, lng: 34.8098 },
  { name: "אילת", lat: 29.5581, lng: 34.9482 },
  { name: "כרמיאל", lat: 32.9186, lng: 35.2952 },
];
