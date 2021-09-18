import { BigNumber, BigNumberish } from 'ethers'

export const bn = (x: BigNumberish) => {
  if (BigNumber.isBigNumber(x)) return x;
  return BigNumber.from(x);
}
