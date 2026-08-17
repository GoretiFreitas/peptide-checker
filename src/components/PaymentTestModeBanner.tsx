const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-red-300 bg-red-100 px-4 py-2 text-center text-xs tracking-wide text-red-800">
        Production checkout isn&apos;t configured. Complete Stripe go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-xs tracking-wide text-orange-900">
        Test mode — use card <span className="font-mono">4242 4242 4242 4242</span> · any future date · any CVC.
      </div>
    );
  }
  return null;
}
