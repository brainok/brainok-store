export const storeConfigDefaults = {
  lifetimePlans: [
    {
      id: "lifetime_2",
      name: "Brainok Lifetime License - 2 devices",
      maxDevices: 2,
      amount: 20000,
      currency: "KRW",
      paypalAmount: 15,
      paypalCurrency: "USD"
    },
    {
      id: "lifetime_5",
      name: "Brainok Lifetime License - 5 devices",
      maxDevices: 5,
      amount: 40000,
      currency: "KRW",
      paypalAmount: 30,
      paypalCurrency: "USD"
    }
  ],
  bankTransfer: {
    bankName: "우리은행",
    accountNumber: "126-296921-12-001",
    accountHolder: "남효석"
  },
  supportEmail: "brainok777@gmail.com"
} as const;
