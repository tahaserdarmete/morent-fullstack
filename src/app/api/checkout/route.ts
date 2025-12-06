import connectDB from "@/lib/mongodb";
import Car, { ICar } from "@/models/car";
import { Order } from "@/models/order";
import { Car as CarType, CheckoutBody } from "@/types/car";
import { getCurrentUser } from "@/utils/auth-utils";
import { NextResponse } from "next/server";
import Stripe from "stripe";

// stripe kurulumu
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

// Katologa ürün ekleme fonksiyonu
const createStripeProduct = async (car: CarType) => {
  return await stripe.products.create({
    name: car.make + " " + car.modelName,
    description: car.description,
    images: car.images,
    default_price_data: {
      currency: "USD",
      unit_amount: car.pricePerDay * 100,
    },
    metadata: {
      car_id: car._id.toString(),
    },
  });
};

// KAtologtaki ürünleri listeleme fonksiyonu
const getStripeProduct = async (car: CarType) => {
  const result = await stripe.products.search({
    query: `metadata["car_id"]:"${car._id.toString()}"`,
  });

  return result.data[0] || null;
};

export async function POST(req: Request) {
  try {
    // veritabanına bağlan
    await connectDB();

    // kullanıcının oturum verisini al
    const user = await getCurrentUser();

    // kullanıcı oturumu kapalıysa hata döndür
    if (!user) {
      return NextResponse.json(
        { message: "Kullanıcı oturumu kapaılı" },
        { status: 401 }
      );
    }

    // isteğin body bölümündeki verilere eriş
    const body: CheckoutBody = await req.json();

    // kiralanacak aracın bilgilerini al
    const car: CarType | null = await Car.findById(body.carId);

    // araç verisi alınamadıysa
    if (car === null) {
      return NextResponse.json({ message: "Araç bulunamadı" }, { status: 404 });
    }

    // kiralanacak ürün stripe product catelog da var mı kontrol et
    let stripeProduct = await getStripeProduct(car);

    // eğer araç stripe product katologda yoksa aracı katologa ekle
    if (!stripeProduct) {
      stripeProduct = await createStripeProduct(car);
    }

    // stripe tarafından oluşturulan product id değerini ve kiralanacak gün sayısını belirle
    const productInfo = {
      price: stripeProduct.default_price,
      quantity: Math.ceil(
        (new Date(body.returnDate).getTime() -
          new Date(body.pickupDate).getTime()) /
          (24 * 60 * 60 * 1000)
      ),
    };

    // sipariş verisini veritabanına kaydet
    const order = await Order.create({
      product: car._id,
      user: user.id,
      totalAmount: car.pricePerDay * productInfo.quantity,
      currency: "USD",
      type: "rental",
      status: "pending",
      rental: {
        pickupDate: new Date(body.pickupDate),
        returnDate: new Date(body.returnDate),
        pickupTime: body.pickupTime,
        returnTime: body.returnTime,
        pickupLocation: body.pickupLocation,
        dropoffLocation: body.dropoffLocation,
        additionalNotes: body.additionalNotes,
        days: productInfo.quantity,
      },
    });

    // stripe ödeme oturumu oluştur
    const session = await stripe.checkout.sessions.create({
      line_items: [productInfo as Stripe.Checkout.SessionCreateParams.LineItem],
      mode: "payment",
      metadata: {
        user_id: user.id,
        order_id: order._id.toString(),
      },
      success_url: `${
        process.env.NEXTAUTH_URL
      }/success?orderId=${order._id.toString()}`,
      cancel_url: `${
        process.env.NEXTAUTH_URL
      }/cancel?orderId=${order._id.toString()}`,
    });

    // client a cevap gönder
    return NextResponse.json(
      { message: "Ödeme Oturumu Oluşturuldu", url: session.url },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { message: "Bir hata oluştu", error },
      { status: 500 }
    );
  }
}
