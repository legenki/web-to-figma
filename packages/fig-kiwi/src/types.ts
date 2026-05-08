export type Field = {
  name: string;
  datatype: number;
  array: boolean;
  datatype_name: string;
};

export type TypeDef = {
  kind: number;
  kind_name: string;
  name: string;
  fields: Record<string, Field>;
  field_count: number;
  index: number;
};

export type Schema = {
  version: number;
  types: Array<TypeDef>;
  type_count: number;
};
