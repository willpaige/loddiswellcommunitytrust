"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const [mapLatitude, setMapLatitude] = useState("50.325178");
  const [mapLongitude, setMapLongitude] = useState("-3.80193");
  const [mapZoom, setMapZoom] = useState("351");
  const [emailAddress, setEmailAddress] = useState(
    "hello@loddiswellcommunitytrust.org"
  );
  const [postalAddress, setPostalAddress] = useState("");
  const [villageHallAddress, setVillageHallAddress] = useState("");
  const [pavilionAddress, setPavilionAddress] = useState("");
  const [bookingsPhoneNumber, setBookingsPhoneNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  useEffect(() => {
    async function load() {
      const { getSettings } = await import("@/actions/settings");
      const settings = await getSettings();
      if (settings) {
        setMapLatitude(settings.mapLatitude);
        setMapLongitude(settings.mapLongitude);
        setMapZoom(settings.mapZoom);
        setEmailAddress(settings.emailAddress);
        setPostalAddress(settings.postalAddress || "");
        setVillageHallAddress(settings.villageHallAddress || "");
        setPavilionAddress(settings.pavilionAddress || "");
        setBookingsPhoneNumber(settings.bookingsPhoneNumber || "");
        setPhoneNumber(settings.phoneNumber || "");
      }
      setPageLoading(false);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const { updateSettings } = await import("@/actions/settings");
    const formData = new FormData();
    formData.set("mapLatitude", mapLatitude);
    formData.set("mapLongitude", mapLongitude);
    formData.set("mapZoom", mapZoom);
    formData.set("emailAddress", emailAddress);
    formData.set("postalAddress", postalAddress);
    formData.set("villageHallAddress", villageHallAddress);
    formData.set("pavilionAddress", pavilionAddress);
    formData.set("bookingsPhoneNumber", bookingsPhoneNumber);
    formData.set("phoneNumber", phoneNumber);

    try {
      await updateSettings(formData);
      router.refresh();
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
        <Link href="/admin">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Link>
      </Button>
      <h1 className="text-3xl font-bold mb-8">Site Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Map Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mapLatitude">Latitude</Label>
                <Input
                  id="mapLatitude"
                  type="number"
                  step="0.000001"
                  value={mapLatitude}
                  onChange={(e) => setMapLatitude(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapLongitude">Longitude</Label>
                <Input
                  id="mapLongitude"
                  type="number"
                  step="0.000001"
                  value={mapLongitude}
                  onChange={(e) => setMapLongitude(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mapZoom">Zoom</Label>
                <Input
                  id="mapZoom"
                  type="number"
                  value={mapZoom}
                  onChange={(e) => setMapZoom(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="emailAddress">Email Address</Label>
              <Input
                id="emailAddress"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g., 01548 550123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookingsPhoneNumber">
                Bookings Phone Number
              </Label>
              <Input
                id="bookingsPhoneNumber"
                value={bookingsPhoneNumber}
                onChange={(e) => setBookingsPhoneNumber(e.target.value)}
                placeholder="e.g., 07716 162407"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalAddress">Postal Address</Label>
              <Textarea
                id="postalAddress"
                value={postalAddress}
                onChange={(e) => setPostalAddress(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="villageHallAddress">Village Hall Address</Label>
              <Textarea
                id="villageHallAddress"
                value={villageHallAddress}
                onChange={(e) => setVillageHallAddress(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pavilionAddress">Pavilion Address</Label>
              <Textarea
                id="pavilionAddress"
                value={pavilionAddress}
                onChange={(e) => setPavilionAddress(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Button type="submit" disabled={loading}>
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Save Settings
        </Button>
      </form>
    </div>
  );
}
