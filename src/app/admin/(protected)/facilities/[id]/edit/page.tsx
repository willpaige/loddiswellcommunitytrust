"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function EditFacilityPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("{}");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState("");
  const [features, setFeatures] = useState("");
  const [rates, setRates] = useState("");
  const [bookingInfo, setBookingInfo] = useState("");
  const [externalBookingUrl, setExternalBookingUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { getFacilities } = await import("@/actions/facilities");
      const all = await getFacilities();
      const facility = all.find((f) => f.id === id);
      if (facility) {
        setName(facility.name);
        setDescription(facility.description);
        setAddress(facility.address || "");
        setCapacity(facility.capacity?.toString() || "");
        setFeatures(
          facility.features ? (facility.features as string[]).join("\n") : ""
        );
        setRates(facility.rates ? JSON.stringify(facility.rates, null, 2) : "");
        setBookingInfo(facility.bookingInfo || "");
        setExternalBookingUrl(facility.externalBookingUrl || "");
        setHeroImageUrl(facility.heroImageUrl || "");
        setPublished(facility.published ?? true);
      }
      setPageLoading(false);
    }
    load();
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { updateFacility } = await import("@/actions/facilities");
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("address", address);
    formData.set("capacity", capacity);
    formData.set(
      "features",
      JSON.stringify(features.split("\n").filter(Boolean))
    );
    formData.set("rates", rates || "null");
    formData.set("bookingInfo", bookingInfo);
    formData.set("externalBookingUrl", externalBookingUrl);
    formData.set("heroImageUrl", heroImageUrl);
    formData.set("published", published ? "on" : "off");

    try {
      await updateFacility(id, formData);
      router.push("/admin/facilities");
    } catch {
      setLoading(false);
    }
  }

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="link" asChild className="mb-6 px-0 text-muted-foreground">
        <Link href="/admin/facilities">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Facilities
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">Edit: {name}</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Facility Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor content={description} onChange={setDescription} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  type="number"
                  id="capacity"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g., 100"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Features (one per line)</Label>
              <Textarea
                id="features"
                value={features}
                onChange={(e) => setFeatures(e.target.value)}
                rows={4}
                placeholder="Kitchen&#10;Bar&#10;Parking&#10;Meeting Room"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking & Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rates">Rates (JSON format)</Label>
              <Textarea
                id="rates"
                value={rates}
                onChange={(e) => setRates(e.target.value)}
                rows={4}
                placeholder='{"Hourly rate": "£15", "Half day": "£50"}'
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter as JSON key-value pairs, e.g., {`{"Hourly": "£15"}`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingInfo">Booking Information</Label>
              <Textarea
                id="bookingInfo"
                value={bookingInfo}
                onChange={(e) => setBookingInfo(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalBookingUrl">External Booking URL</Label>
              <Input
                type="url"
                id="externalBookingUrl"
                value={externalBookingUrl}
                onChange={(e) => setExternalBookingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="heroImageUrl">Hero Image URL</Label>
              <Input
                type="url"
                id="heroImageUrl"
                value={heroImageUrl}
                onChange={(e) => setHeroImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Checkbox
                id="published"
                checked={published}
                onCheckedChange={(v) => setPublished(v === true)}
              />
              <Label htmlFor="published" className="font-normal">
                Published (visible on the website)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save Changes
        </Button>
      </form>
    </div>
  );
}
