export type Controller = {
  getAll: (req: any, res: any, next?: any) => Promise<void>;
  getById: (req: any, res: any, next?: any) => Promise<void>;
  add: (req: any, res: any, next?: any) => Promise<void>;
  updateById: (req: any, res: any, next?: any) => Promise<void>;
  deleteById: (req: any, res: any, next?: any) => Promise<void>;
};

const controller: Controller = {
  getAll: async () => {},
  getById: async () => {},
  add: async () => {},
  updateById: async () => {},
  deleteById: async () => {},
};

export default controller;