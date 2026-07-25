export type CustomerSource = {
  id: string;
  name: string;
};

export type Customer = {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  /** Referencia `CustomerSource.id`. */
  sourceId: string;
};
