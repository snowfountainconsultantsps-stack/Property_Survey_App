// Which asset layer holds property parcels.
//
// Parcels are uploaded as ordinary asset features like any other layer, but
// surveying one runs the full property wizard (saving into Properties /
// Surveys / Units) instead of the single-form asset survey. Matched on the
// catalog code rather than a hardcoded id so the layer can be recreated or
// renamed without breaking the app.
const PROPERTY_CODES = ["PROPERTY", "PROPERTY_BOUNDARY", "PARCEL"];

export function isPropertyLayer(layer) {
  if (!layer) return false;
  const codes = [layer.code, layer.category?.code, layer.category_code]
    .filter(Boolean)
    .map((c) => String(c).toUpperCase());
  return codes.some((c) => PROPERTY_CODES.includes(c));
}

export default isPropertyLayer;
