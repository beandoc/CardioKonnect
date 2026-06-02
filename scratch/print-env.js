console.log(
  Object.keys(process.env)
    .filter(k => k.startsWith('NEXT_PUBLIC_'))
    .reduce((acc, k) => {
      acc[k] = process.env[k];
      return acc;
    }, {})
);
