"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { posterQrOptions } from "@/lib/poster-qr";

type Destination = { id: string; label: string; url: string };

function PosterQr({ destination }: { destination: Destination }) {
  const [files, setFiles] = useState<{ png: string; svg: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    let current = true;
    Promise.all([
      QRCode.toDataURL(destination.url, { ...posterQrOptions, scale: 32 }),
      QRCode.toString(destination.url, { ...posterQrOptions, type: "svg" }),
    ]).then(([png, svg]) => {
      if (current) setFiles({ png, svg: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });
    }).catch(() => {
      if (current) setError(true);
    });
    return () => { current = false; };
  }, [destination.url]);

  const filename = destination.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "poster";

  return (
    <div className="space-y-4">
      <a className="block break-all text-sm underline" href={destination.url} target="_blank" rel="noopener noreferrer">
        {destination.url}
      </a>
      {files ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={files.png} width={224} height={224} alt={`QR code for ${destination.label}`} />
          <div className="flex flex-wrap gap-2">
            <Button asChild><a href={files.svg} download={`${filename}-qr.svg`}>Download SVG</a></Button>
            <Button asChild variant="outline"><a href={files.png} download={`${filename}-qr.png`}>Download PNG</a></Button>
          </div>
        </>
      ) : (
        <p role="status">{error ? "Could not generate the QR code." : "Generating QR code…"}</p>
      )}
    </div>
  );
}

export function PosterQrGenerator({
  destinations,
  initialId,
}: {
  destinations: Destination[];
  initialId?: string;
}) {
  const [selected, setSelected] = useState(initialId);
  const destination = selected ? destinations.find(({ id }) => id === selected) : destinations[0];

  return (
    <div className="space-y-4 rounded-lg border bg-card p-5">
      <div className="space-y-2">
        <label htmlFor="qr-destination" className="block text-sm font-medium">Destination</label>
        <select
          id="qr-destination"
          value={destination?.id ?? ""}
          onChange={(event) => setSelected(event.target.value)}
          className="w-full rounded-md border bg-background p-2"
        >
          {!destination && <option value="" disabled>Choose a destination</option>}
          {destinations.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {destination ? (
        <PosterQr key={destination.id} destination={destination} />
      ) : (
        <p role="status">That destination is unavailable. Choose another destination above.</p>
      )}
    </div>
  );
}
