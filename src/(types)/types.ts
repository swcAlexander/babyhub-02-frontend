const controller: {
    getAll: (req: any, res: any, next: any) => Promise<void>;
    getById: (req: any, res: any, next: any) => Promise<void>;
    add: (req: any, res: any, next: any) => Promise<void>;
    updateById: (req: any, res: any, next: any) => Promise<void>;
    deleteById: (req: any, res: any, next: any) => Promise<void>;
}
export default controller;