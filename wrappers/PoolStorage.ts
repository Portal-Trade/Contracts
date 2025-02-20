import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from "@ton/core";

export class PoolStorage implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  // Create an instance of the contract from an existing address
  static createFromAddress(address: Address) {
    return new PoolStorage(address);
  }

  // Create an instance of the contract from the code and initial storage data
  static createFromCode(code: Cell, workchain = 0): PoolStorage {
    const init = { code, data: new Cell() }; // Empty initial data
    return new PoolStorage(contractAddress(workchain, init), init);
  }

  // Deploy the contract
  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // Send a message to store the sender's address and message value
  async sendStoreData(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint; // TONs to send with the message
      queryID?: number; // Optional query ID
    }
  ) {
    // Create the message body
    const messageBody = beginCell()
      .storeUint(opts.queryID ?? 0, 64) // Query ID (default to 0 if not provided)
      .endCell();

    // Send the internal message
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  // Retrieve the stored data (supply cell, sender's address, and value)
  async getSupply(provider: ContractProvider) {
    const result = (await provider.get('get_supply', [])).stack;

    // Parse the returned values
    const supplyCell = result.readCell();
    const userAddress = result.readCell();
    const userAmount = result.readNumber();

    return { supplyCell, userAddress, userAmount };
  }

  // Execute liquidation if health factor is low
  async execute_liquidation_call(
    provider: ContractProvider,
    sender: Sender,
    collateralAsset: Address,
    debtAsset: Address,
    user: Address,
    debtToCover: bigint,
    receiveAToken: boolean
  ) {
    const messageBody = beginCell()
      .storeAddress(collateralAsset)  // 담보 자산 주소
      .storeAddress(debtAsset)        // 부채 자산 주소
      .storeAddress(user)             // 청산 대상 사용자 주소
      .storeUint(debtToCover, 128)    // 상환할 부채 금액
      .storeUint(receiveAToken ? 1 : 0, 8)  // A토큰 수령 여부 (1: Yes, 0: No)
      .endCell();

    // 청산 호출 메서드 실행
    await provider.internal(sender, {
      value: 0n,  // 청산에는 TON을 전송하지 않음
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });

    console.log('Liquidation call executed for user:', user.toString());
  }
}