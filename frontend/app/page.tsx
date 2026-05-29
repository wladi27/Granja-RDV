export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 pb-10 pt-6 md:px-6 md:pt-10">
      <section className="mb-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7d8b89]">Granja Raiz de Vida</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#1a1d1c] sm:text-3xl">UI estilo app de tienda movil</h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-[#778380]">Rediseño visual inspirado en la referencia: tarjetas suaves, buscador protagonista, categorias, productos y detalle limpio.</p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <article className="mx-auto w-full max-w-[360px] rounded-[28px] bg-[#f7f7f7] p-4 shadow-[0_24px_70px_rgba(20,20,20,0.18)]">
          <div className="rounded-[22px] bg-[#ededed] p-4">
            <div className="mb-4 flex items-center justify-between text-[13px] font-semibold text-[#111]">
              <span>9:41</span>
              <span className="tracking-[0.18em]">•••</span>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <button className="grid h-10 w-10 place-items-center rounded-full bg-[#f4f4f4] text-xl text-[#444] shadow-sm" type="button">
                ≡
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-[#f4f4f4] text-[#444] shadow-sm" type="button">
                ⌂
              </button>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm">
              <span className="text-[#9da6a5]">⌕</span>
              <input className="w-full bg-transparent text-sm text-[#5f6665] outline-none" placeholder="what are you looking for?" />
              <span className="text-[#8a9392]">⚙</span>
            </div>

            <div className="mb-4 overflow-hidden rounded-[20px] bg-[linear-gradient(125deg,#cde96b,#9fd452)] p-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <span className="inline-block rounded-full bg-black px-2 py-1 text-[10px] font-medium text-white">Limited Offer</span>
                  <p className="mt-2 max-w-[170px] text-lg font-semibold leading-6 text-[#131816]">First Purchase Enjoy a Special Offer</p>
                  <button className="mt-3 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white" type="button">
                    Shop Now ↗
                  </button>
                </div>
                <div className="h-24 w-24 rounded-full bg-white/45" />
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1d2020]">Categories</h2>
              <span className="text-xs font-semibold text-[#9bb441]">See all</span>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-2 text-xs font-medium text-[#28302f]">
              <div className="rounded-xl bg-[#f8f8f8] p-2">Men&apos;s outfit</div>
              <div className="rounded-xl bg-[#f8f8f8] p-2">woman&apos;s outfit</div>
              <div className="rounded-xl bg-[#f8f8f8] p-2">Men&apos;s footwears</div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1d2020]">New Arrival</h2>
              <span className="text-xs font-semibold text-[#9bb441]">See all</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="overflow-hidden rounded-2xl bg-[#f8f8f8] p-2">
                <div className="h-28 rounded-xl bg-[linear-gradient(180deg,#cab9a5,#8f7359)]" />
                <p className="mt-2 text-xs text-[#2d302f]">COP 210.000</p>
              </div>
              <div className="overflow-hidden rounded-2xl bg-[#f8f8f8] p-2">
                <div className="h-28 rounded-xl bg-[linear-gradient(180deg,#d8d8d8,#bfbfbf)]" />
                <p className="mt-2 text-xs text-[#2d302f]">COP 120.000</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 rounded-full bg-[#f4f4f4] p-2 text-center text-[13px] font-medium text-[#4f5554]">
              <span className="rounded-full bg-[#d9e6a8] py-2 text-[#1b1f1d]">Home</span>
              <span className="py-2">Bag</span>
              <span className="py-2">❤</span>
              <span className="py-2">User</span>
            </div>
          </div>
        </article>

        <article className="mx-auto hidden w-full max-w-[360px] rounded-[28px] bg-[#f7f7f7] p-4 shadow-[0_24px_70px_rgba(20,20,20,0.18)] md:block">
          <div className="rounded-[22px] bg-[#ededed] p-4">
            <div className="mb-4 flex items-center justify-between text-[13px] font-semibold text-[#111]">
              <span>9:41</span>
              <span className="tracking-[0.18em]">•••</span>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <button className="grid h-10 w-10 place-items-center rounded-full bg-[#f4f4f4] text-xl text-[#444] shadow-sm" type="button">
                ‹
              </button>
              <h2 className="text-lg font-semibold text-[#171b1a]">Details</h2>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-[#f4f4f4] text-[#444] shadow-sm" type="button">
                ⌂
              </button>
            </div>

            <div className="mb-3 h-56 rounded-3xl bg-[linear-gradient(180deg,#dbdbdb,#c8c8c8)]" />
            <p className="text-xs text-[#9aa1a0]">Men Footwear</p>
            <h3 className="mt-1 text-3xl font-semibold text-[#171b1a]">Grey Casual shoe</h3>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#1f2322]">Velora Store ✓</p>
                <p className="text-xs text-[#8f9796]">Official store</p>
              </div>
              <button className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white" type="button">
                Following
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[#8b9492]">
                <span>Select size</span>
                <span>QTY</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex gap-2 text-xs font-semibold text-[#282e2d]">
                  <button className="rounded-lg bg-white px-3 py-2" type="button">S</button>
                  <button className="rounded-lg bg-white px-3 py-2" type="button">M</button>
                  <button className="rounded-lg bg-[#cfe37e] px-3 py-2" type="button">L</button>
                  <button className="rounded-lg bg-white px-3 py-2" type="button">XL</button>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 text-sm">
                  <span>-</span>
                  <span className="font-semibold">1</span>
                  <span>+</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#f6f6f6] p-3">
              <p className="text-[11px] text-[#8a9190]">Total price</p>
              <div className="mt-2 flex items-center justify-between">
                <strong className="text-3xl font-semibold text-[#171b1a]">COP 120.000</strong>
                <a className="rounded-full bg-[#cbe86a] px-5 py-3 text-sm font-semibold text-[#1b1f1d]" href="/login">
                  Add to Cart
                </a>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
        <a className="rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white" href="/login">
          Entrar
        </a>
        <a className="rounded-full border border-[#d6d9d8] bg-white px-5 py-2.5 text-sm font-semibold text-[#202625]" href="/register">
          Crear cuenta
        </a>
      </section>
    </main>
  );
}
