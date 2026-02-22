export const fisherYatesShuffle = <T>(source: readonly T[], random: () => number = Math.random): T[] => {
  const copy = [...source];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};
