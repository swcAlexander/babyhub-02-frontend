export const handlleSaveError = (error, data, next) => {
  const { name, code } = error;
  error.status = name === 'MongoServerError' && code === 11000 ? 409 : 400;
  next();
};

export const runValidateAtupdate = function (next) {
  this.options.runValidators = true;
  next();
};
