import { db } from "@/lib/db";
import { facilities } from "./schema";
import { doc, paragraph, type TiptapJSON } from "@/lib/cms/render";

function descriptionDoc(text: string): TiptapJSON {
  // Hardcoded copy used \n\n for paragraph breaks.
  const paragraphs = text.split("\n\n").map((p) => p.trim()).filter(Boolean);
  return doc(...paragraphs.map((p) => paragraph(p)));
}

type FacilitySeed = {
  slug: string;
  name: string;
  description: TiptapJSON;
  address: string | null;
  capacity: number | null;
  features: string[];
  rates: Record<string, string> | null;
  bookingInfo: string | null;
  externalBookingUrl: string | null;
  sortOrder: number;
};

const facilitySeeds: FacilitySeed[] = [
  {
    slug: "village-hall",
    name: "Village Hall",
    description: descriptionDoc(
      "The Loddiswell Village Hall is a spacious, well-maintained venue suitable for up to 100 people. Located on South Brent Road next to the main car park, the hall features a well-equipped kitchen adjacent to the main room, bar facilities, and a separate meeting room.\n\nThe hall is ideal for private parties, celebrations, community events, regular group meetings, and more. It has been the heart of many community gatherings including the annual Loddiswell Show and various club activities."
    ),
    address: "South Brent Road, Loddiswell, TQ7 4RH",
    capacity: 100,
    features: [
      "Main hall for up to 100 people",
      "Well-equipped kitchen",
      "Bar facilities",
      "Meeting room",
      "Adjacent car parking",
      "Accessible entrance",
    ],
    rates: {
      "Hourly rate": "Contact for rates",
      "Half day": "Contact for rates",
      "Full day": "Contact for rates",
      "Evening hire": "Contact for rates",
    },
    bookingInfo:
      "To check availability and make a booking, please contact our Bookings Secretary on 07716 162407 or email us.",
    externalBookingUrl: null,
    sortOrder: 10,
  },
  {
    slug: "pavilion",
    name: "Pavilion",
    description: descriptionDoc(
      "The Pavilion Building is a multi-purpose facility located at the Loddiswell Playing Fields. It serves as a hub for sports activities and community events, with changing rooms and a covered area.\n\nThe pavilion is perfect for sports events, outdoor gatherings, and community activities. It provides essential facilities for teams using the playing fields and is available for private hire."
    ),
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    capacity: null,
    features: [
      "Changing rooms",
      "Covered area",
      "Adjacent to playing field",
      "Toilet facilities",
    ],
    rates: {
      "Hourly rate": "Contact for rates",
      "Half day": "Contact for rates",
      "Full day": "Contact for rates",
    },
    bookingInfo:
      "To check availability and make a booking, please contact our Bookings Secretary on 07716 162407 or email us.",
    externalBookingUrl: null,
    sortOrder: 20,
  },
  {
    slug: "tennis-courts",
    name: "Tennis Courts",
    description: descriptionDoc(
      "The Loddiswell Tennis Courts are community facilities managed by the Loddiswell Tennis Club, part of the LTA. The courts are open to both members and visitors.\n\nVisitors can book courts at £6 per hour. A key for the visitors’ gate must be collected from the village Spar shop (RS Stores) — a deposit is charged which is refunded when the key is returned.\n\nThe Tennis Club offers regular club sessions, coaching, and social events throughout the year. New members of all abilities are always welcome."
    ),
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    capacity: null,
    features: [
      "Visitors: £6 per hour",
      "Key from RS Stores (01548 550258)",
      "Club membership available",
      "Coaching sessions",
      "Social events",
    ],
    rates: null,
    bookingInfo:
      "Visitors: Collect the court key from RS Stores (the village Spar shop) — 01548 550258. A deposit is charged and refunded when the key is returned. For club membership and sessions, visit the ClubSpark page.",
    externalBookingUrl:
      "https://clubspark.lta.org.uk/LoddiswellTennisClub/Booking/BookByDate",
    sortOrder: 30,
  },
  {
    slug: "playing-field",
    name: "Playing Field",
    description: descriptionDoc(
      "The Loddiswell Playing Field is a large, open green space available for sports and recreational activities. The field is used for football, rounders, and other community sports throughout the year.\n\nThe field also serves as a designated landing site for the Devon Air Ambulance (including night landings) and hosts the annual Loddiswell Show — a beloved community event celebrating its centenary in 2024.\n\nThe children’s play park is located on the playing field and is open to all."
    ),
    address: "Loddiswell Playing Fields, Loddiswell, TQ7 4QH",
    capacity: null,
    features: [
      "Football pitch",
      "Open space for rounders and sports",
      "Children’s play park",
      "Devon Air Ambulance landing site",
      "Loddiswell Show venue",
    ],
    rates: null,
    bookingInfo:
      "The playing field is generally open for community use. For organised events or regular bookings, please contact the Trust.",
    externalBookingUrl: null,
    sortOrder: 40,
  },
  {
    slug: "pump-track",
    name: "Pump Track",
    description: descriptionDoc(
      "Plans are underway to build a pump track at Loddiswell Playing Fields — a modern cycling facility featuring a circuit of small hills and banked corners designed for bikes, scooters, and skateboards.\n\nThe pump track will be surfaced in tarmac or concrete, requiring minimal maintenance while providing year-round use. It is designed to work for all skill levels and ages, from young children to experienced riders.\n\nThe project aims to create a vibrant hub for healthy, inclusive recreation that fosters social interaction and offers a safe space for wheeled sports.\n\nVisit the dedicated Loddiswell Pump Track website for the latest news, fundraising progress, and ways to get involved."
    ),
    address: "Loddiswell Playing Fields (planned)",
    capacity: null,
    features: [
      "All ages and abilities",
      "Bikes, scooters, and skateboards",
      "Tarmac/concrete surface",
      "Year-round use",
      "Currently in planning/fundraising",
    ],
    rates: null,
    bookingInfo:
      "The pump track is currently in the planning and fundraising stage. Visit the Loddiswell Pump Track website for the latest updates and ways to support the project.",
    externalBookingUrl: "https://loddiswellpumptrack.co.uk/",
    sortOrder: 50,
  },
];

export async function seedFacilities() {
  console.log("Seeding facilities...");
  for (const facility of facilitySeeds) {
    await db
      .insert(facilities)
      .values({
        slug: facility.slug,
        name: facility.name,
        description: JSON.stringify(facility.description),
        address: facility.address,
        capacity: facility.capacity,
        features: facility.features,
        rates: facility.rates,
        bookingInfo: facility.bookingInfo,
        externalBookingUrl: facility.externalBookingUrl,
        sortOrder: facility.sortOrder,
        published: true,
      })
      .onConflictDoNothing({ target: facilities.slug });
    console.log(`  ✓ ${facility.slug}`);
  }
  console.log("Facilities seeded.");
}
