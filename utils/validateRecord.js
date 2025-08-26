function castValueByType(value, type) {
  if (value === null || value === undefined) return value;
  switch (type) {
    case "number": return value === "" ? null : Number(value);
    case "boolean": return !!value;
    case "multiselect": return Array.isArray(value) ? value : (value ? [value] : []);
    case "date": return value ? new Date(value) : null;
    default: return value; // text/select/file/relation
  }
}

function validateAgainstFields(inputData, fields) {
  const errors = {};
  const clean = {};

  for (const f of fields.filter(x => x.active)) {
    const v = inputData[f.key];
    const casted = castValueByType(v, f.type);

    // required
    if (f.validation?.required && (casted === undefined || casted === null || casted === "" || (Array.isArray(casted) && !casted.length))) {
      errors[f.key] = "Required";
      continue;
    }

    // number bounds
    if (f.type === "number") {
      if (f.validation?.min != null && casted < f.validation.min) errors[f.key] = `Min ${f.validation.min}`;
      if (f.validation?.max != null && casted > f.validation.max) errors[f.key] = `Max ${f.validation.max}`;
    }

    // regex
    if (f.validation?.regex && casted) {
      const re = new RegExp(f.validation.regex);
      if (!re.test(String(casted))) errors[f.key] = "Invalid format";
    }

    clean[f.key] = casted;
  }

  return { valid: Object.keys(errors).length === 0, clean, errors };
}

module.exports = { validateAgainstFields };
