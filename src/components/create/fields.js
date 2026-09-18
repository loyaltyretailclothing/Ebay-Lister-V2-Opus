"use client";

import { useState } from "react";
import { DEFAULTS } from "@/lib/constants";
import { hasTitleParts } from "@/lib/titleKeywords";
import { LockIcon, Spinner } from "@/components/ui/Icons";
import {
  KeywordChips,
  PickButton,
  Select,
  SpecificPicker,
  SpecificSheet,
  Toggle,
  categoryLabel,
  isFilled,
} from "@/components/create/parts";

// The listing form's fields, written once and used by both layouts. `touch`
// switches to the phone sizes (44px controls, larger text).
//   listing — the listing
//   form    — useListingForm()

const T = {
  input: (touch) => (touch ? "input h-touch rounded-panel text-lg" : "input"),
  select: (touch) => (touch ? "h-touch rounded-panel text-lg" : ""),
  textarea: (touch) => (touch ? "textarea rounded-panel p-3 text-lg leading-5" : "textarea"),
};

export function TitleField({ listing, form, touch }) {
  const len = (listing.title || "").length;
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <label className="fl" htmlFor="title">
          Title
        </label>
        <div className="grow" />
        <span className={`mono text-ink-2 ${touch ? "text-base" : "text-sm"}`}>{len} / 80</span>
      </div>
      {/* Two (phone: three) lines so all 80 characters stay visible. */}
      <textarea
        id="title"
        rows={touch ? 3 : 2}
        maxLength={80}
        value={listing.title || ""}
        onChange={(e) => form.handleTitleChange(e.target.value.replace(/\s*\n\s*/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder="Brand, line, item, department, size, colour, keyword"
        className={`${T.textarea(touch)} ${touch ? "" : "leading-[19px]"}`}
      />
    </div>
  );
}

export function Keywords({ listing, form, touch }) {
  return (
    <KeywordChips
      keywords={hasTitleParts(listing) ? listing.keywords : []}
      onToggle={form.handleKeywordToggle}
      disabled={form.fillingSpecifics || form.loadingSpecifics}
      hasTheme={form.categoryHasTheme}
      notice={form.keywordNotice}
      touch={touch}
    />
  );
}

export function CategoryField({ listing, form, touch }) {
  const current = form.categories.find((c) => c.id === listing.categoryId);
  const caption = current ? categoryLabel(current).parent : "";
  return (
    <div className={touch ? "" : "min-w-[200px] flex-[1_1_240px]"}>
      <label className="fl" htmlFor="cat">
        Category
      </label>
      <Select
        id="cat"
        value={listing.categoryId || ""}
        onChange={form.handleCategoryChange}
        invalid={form.isNewCategory}
        className={T.select(touch)}
      >
        <option value="">
          {form.loadingCategories ? "Looking up categories…" : "Choose a category"}
        </option>
        {listing.categoryId && !current && (
          <option value={listing.categoryId}>{listing.categoryName || listing.categoryId}</option>
        )}
        {form.categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {categoryLabel(cat).tail}
          </option>
        ))}
      </Select>
      {form.isNewCategory ? (
        <p className="mt-1 text-sm font-medium text-bad">
          NEW category — configure its multi-value specifics in Settings.
        </p>
      ) : (
        caption && <p className={`hint mt-1 ${touch ? "" : "text-sm"}`}>In {caption}</p>
      )}
    </div>
  );
}

export function SkuField({ listing, form, touch }) {
  return (
    <div className={touch ? "" : "min-w-[120px] flex-[0_1_170px]"}>
      <label className="fl" htmlFor="sku">
        SKU <span className="text-bad">*</span>
      </label>
      <input
        id="sku"
        type="text"
        value={listing.sku || ""}
        onChange={(e) => form.handleChange("sku", e.target.value)}
        placeholder="Required"
        className={`${T.input(touch)} mono ${form.skuMissing ? "input-invalid" : ""}`}
      />
      {form.skuMissing && (
        <p className={`mt-1 text-bad ${touch ? "text-base" : "text-sm"}`}>
          Required. Must be a SKU that has never been used on eBay — used SKUs are blocked.
        </p>
      )}
    </div>
  );
}

// Item specifics. Nothing until a category is chosen (the fields come from
// eBay per category). "Additional" shows only filled fields until Show all.
export function Specifics({ listing, form, touch }) {
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState(null); // spec being edited (phone)

  if (!listing.categoryId) {
    return <p className="hint">Item specifics appear once a category is chosen.</p>;
  }
  if (form.loadingSpecifics || form.fillingSpecifics) {
    return (
      <p className="hint flex items-center gap-2">
        <Spinner className="size-3.5 text-accent" />
        {form.fillingSpecifics ? "AI is filling item specifics…" : "Loading item specifics…"}
      </p>
    );
  }
  if (form.specifics.length === 0) {
    return <p className="hint">No item specifics for this category.</p>;
  }

  const value = (spec) => listing.itemSpecifics?.[spec.name] || "";
  const additional = form.additionalSpecifics;
  const filled = additional.filter((s) => isFilled(value(s)));
  const empty = additional.length - filled.length;
  const shown = showAll ? [...filled, ...additional.filter((s) => !isFilled(value(s)))] : filled;

  const field = (spec) =>
    touch ? (
      <PickButton
        key={spec.name}
        label={spec.localizedName}
        required={spec.required}
        value={value(spec)}
        onOpen={() => setSheet(spec)}
      />
    ) : (
      <SpecificPicker
        key={spec.name}
        label={spec.localizedName}
        required={spec.required}
        options={spec.values}
        value={value(spec)}
        onChange={(v) => form.handleSpecificChange(spec.name, v)}
        multiSelect={form.isMulti(spec.name)}
        maxValues={spec.maxValues}
      />
    );

  const grid = touch ? "grid grid-cols-2 gap-[9px]" : "spec-grid grid gap-2";

  return (
    <div>
      {form.requiredSpecifics.length > 0 && (
        <>
          <p className={`lbl ${touch ? "mb-2" : "mb-1.5 text-xs"}`}>Required</p>
          <div className={grid}>{form.requiredSpecifics.map(field)}</div>
        </>
      )}
      {additional.length > 0 && (
        <>
          <div className={`flex items-center gap-2 ${touch ? "mb-2 mt-4" : "mt-3"}`}>
            <p className={`lbl ${touch ? "" : "text-xs"}`}>Additional</p>
            <span className={`mono text-ink-3 ${touch ? "text-sm" : "text-xs"}`}>
              {filled.length} filled · {empty} empty
            </span>
            <div className="grow" />
            {empty > 0 && (
              <button
                type="button"
                className={touch ? "btn h-[34px] px-2.5 text-base" : "btn btn-sm"}
                onClick={() => setShowAll((s) => !s)}
              >
                {showAll ? "Show filled only" : `Show all ${additional.length}`}
              </button>
            )}
          </div>
          {shown.length > 0 ? (
            <div className={`${grid} ${touch ? "" : "mt-[7px]"}`}>{shown.map(field)}</div>
          ) : (
            <p className="hint mt-1.5">None filled yet.</p>
          )}
        </>
      )}
      {touch && sheet && (
        <SpecificSheet
          open
          onClose={() => setSheet(null)}
          label={sheet.localizedName}
          options={sheet.values}
          value={value(sheet)}
          onChange={(v) => form.handleSpecificChange(sheet.name, v)}
          multiSelect={form.isMulti(sheet.name)}
          maxValues={sheet.maxValues}
        />
      )}
    </div>
  );
}

export function ConditionFields({ listing, form, touch }) {
  const preOwned = listing.condition?.startsWith("PRE_OWNED");
  return (
    <div className={touch ? "flex flex-col gap-3.5" : "row"}>
      <div className={touch ? "" : "min-w-[150px] flex-[0_1_196px]"}>
        <label className="fl" htmlFor="cond">
          Condition
        </label>
        <Select
          id="cond"
          value={listing.condition || ""}
          onChange={(v) => form.handleChange("condition", v)}
          className={T.select(touch)}
        >
          <option value="">Choose a condition</option>
          {form.allowedConditions.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      {/* Condition Description shows only for the Pre-Owned grades */}
      {preOwned && (
        <div className={touch ? "" : "min-w-[180px] flex-[1_1_200px]"}>
          <label className="fl" htmlFor="cond-desc">
            Condition Description
          </label>
          <textarea
            id="cond-desc"
            rows={2}
            value={listing.condition_description || ""}
            onChange={(e) => form.handleChange("condition_description", e.target.value)}
            className={T.textarea(touch)}
          />
        </div>
      )}
    </div>
  );
}

export function DescriptionField({ listing, form, touch }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label className="fl" htmlFor="desc">
          Description
        </label>
        <div className="grow" />
        <span className={`text-ink-3 ${touch ? "text-sm" : "text-xs"}`}>Scrolls in place</span>
      </div>
      {/* Fixed height on purpose: a long description must never push pricing
          and shipping off the screen. */}
      <textarea
        id="desc"
        value={listing.item_description || ""}
        onChange={(e) => form.handleChange("item_description", e.target.value)}
        placeholder="Written by Analyze Photos, yours to edit"
        className={`${touch ? "textarea h-[150px] rounded-panel p-3 text-md leading-[19px]" : "textarea h-[148px] leading-[19px]"} overflow-y-auto`}
      />
    </div>
  );
}

export function PricingFields({ listing, form, touch }) {
  const type = listing.listingType || DEFAULTS.LISTING_TYPE;
  const seg = (
    <div className={`seg ${touch ? "seg-touch" : ""}`}>
      <button type="button" aria-pressed={type === "FIXED_PRICE"} onClick={() => form.handleChange("listingType", "FIXED_PRICE")}>
        Buy It Now
      </button>
      <button type="button" aria-pressed={type === "AUCTION"} onClick={() => form.handleChange("listingType", "AUCTION")}>
        Auction
      </button>
    </div>
  );
  const price = (
    <input
      id="price"
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      value={listing.price || ""}
      onChange={(e) => form.handleChange("price", e.target.value)}
      className={`${T.input(touch)} mono`}
    />
  );
  const qty = (
    <input
      id="qty"
      type="number"
      min="1"
      inputMode="numeric"
      value={listing.quantity || DEFAULTS.QUANTITY}
      onChange={(e) => form.handleChange("quantity", parseInt(e.target.value))}
      className={`${T.input(touch)} mono`}
    />
  );

  if (touch) {
    return (
      <div className="flex flex-col gap-3.5">
        <div>
          <span className="fl">Format</span>
          {seg}
        </div>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <label className="fl" htmlFor="price">
              Price
            </label>
            {price}
          </div>
          <div className="w-[110px] shrink-0">
            <label className="fl" htmlFor="qty">
              Quantity
            </label>
            {qty}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="row row-end border-t border-line pt-3">
      <div className="min-w-[150px] flex-[0_1_180px]">
        <span className="fl">Format</span>
        {seg}
      </div>
      <div className="min-w-[96px] flex-[0_1_124px]">
        <label className="fl" htmlFor="price">
          Price ($)
        </label>
        {price}
      </div>
      <div className="min-w-[76px] flex-[0_1_100px]">
        <label className="fl" htmlFor="qty">
          Quantity
        </label>
        {qty}
      </div>
    </div>
  );
}

// Allow Offers / Schedule Listing / Promote Listing. Each reveals its own
// fields in place.
export function OptionsGroup({ listing, form, touch }) {
  const promoted = listing.promotedListing !== undefined ? listing.promotedListing : true;
  const num = (id, field, props = {}) => (
    <input
      id={id}
      type="number"
      step="0.01"
      min="0"
      inputMode="decimal"
      value={listing[field] || ""}
      onChange={(e) => form.handleChange(field, e.target.value)}
      className={`${T.input(touch)} mono ${touch ? "" : "w-[84px]"}`}
      {...props}
    />
  );
  const rowText = touch ? "text-lg font-medium" : "whitespace-nowrap text-base font-medium";
  const sub = touch ? "mt-[9px] flex gap-2.5" : "ml-auto flex flex-wrap items-center gap-2";
  const subLabel = touch ? "fl text-sm" : "fl m-0 whitespace-nowrap";

  return (
    <div className={`grp ${touch ? "px-3 py-1" : "px-2.5 py-1"}`}>
      <div className={touch ? "py-2.5" : "flex flex-wrap items-center gap-x-2.5 gap-y-2 py-[7px]"}>
        <div className="flex items-center gap-2.5">
          <Toggle on={listing.bestOffer} onClick={() => form.handleChange("bestOffer", !listing.bestOffer)} label="Allow offers" touch={touch} />
          <span className={rowText}>Allow Offers</span>
        </div>
        {listing.bestOffer && (
          <div className={sub}>
            <div className={touch ? "flex-1" : "flex items-center gap-2"}>
              <label className={subLabel} htmlFor="min-offer">
                {touch ? "Minimum Offer" : "Minimum"}
              </label>
              {num("min-offer", "minOffer")}
            </div>
            <div className={touch ? "flex-1" : "flex items-center gap-2"}>
              <label className={subLabel} htmlFor="auto-accept">
                {touch ? "Auto Accept" : "Auto accept"}
              </label>
              {num("auto-accept", "autoAcceptPrice")}
            </div>
          </div>
        )}
      </div>

      <div className={`border-t border-line ${touch ? "py-2.5" : "flex flex-wrap items-center gap-x-2.5 gap-y-2 py-[7px]"}`}>
        <div className="flex items-center gap-2.5">
          <Toggle
            on={listing.scheduleEnabled}
            onClick={() => form.handleChange("scheduleEnabled", !listing.scheduleEnabled)}
            label="Schedule listing"
            touch={touch}
          />
          <span className={rowText}>Schedule Listing</span>
        </div>
        {listing.scheduleEnabled && (
          <div className={sub}>
            <div className={touch ? "flex-1" : "flex items-center gap-2"}>
              <label className={subLabel} htmlFor="sched-date">
                Date
              </label>
              <input
                id="sched-date"
                type="date"
                value={listing.scheduledDate || ""}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => form.handleChange("scheduledDate", e.target.value)}
                className={`${T.input(touch)} ${touch ? "" : "w-[140px]"}`}
              />
            </div>
            <div className={touch ? "flex-1" : "flex items-center gap-2"}>
              <label className={subLabel} htmlFor="sched-time">
                Time
              </label>
              <input
                id="sched-time"
                type="time"
                value={listing.scheduledTime || "17:00"}
                onChange={(e) => form.handleChange("scheduledTime", e.target.value)}
                className={`${T.input(touch)} ${touch ? "" : "w-[110px]"}`}
              />
            </div>
          </div>
        )}
      </div>

      <div className={`border-t border-line ${touch ? "py-2.5" : "flex flex-wrap items-center gap-x-2.5 gap-y-2 py-[7px]"}`}>
        <div className="flex items-center gap-2.5">
          <Toggle
            on={promoted}
            onClick={() => form.handleChange("promotedListing", !promoted)}
            label="Promote listing"
            touch={touch}
          />
          <span className={rowText}>Promote Listing</span>
        </div>
        {promoted && (
          <div className={touch ? "mt-[9px] w-[140px]" : "ml-auto flex items-center gap-2"}>
            <label className={subLabel} htmlFor="ad-rate">
              Ad rate %
            </label>
            <input
              id="ad-rate"
              type="number"
              step="0.5"
              min="1"
              max="100"
              inputMode="decimal"
              value={listing.promoRate || DEFAULTS.PROMO_RATE}
              onChange={(e) => form.handleChange("promoRate", parseFloat(e.target.value))}
              className={`${T.input(touch)} mono ${touch ? "" : "w-[78px]"}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PolicySelect({ id, label, value, options, onChange, touch, inRow = false }) {
  return (
    <div className={inRow && !touch ? "min-w-[170px] flex-[1_1_200px]" : ""}>
      <label className="fl" htmlFor={id}>
        {label}
      </label>
      {options.length > 0 ? (
        <Select id={id} value={value || ""} onChange={onChange} className={T.select(touch)}>
          <option value="">Choose a policy</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label || p.id}
            </option>
          ))}
        </Select>
      ) : (
        <div
          className={`flex items-center gap-2 rounded-field border border-dashed border-line-strong bg-sunken px-2.5 ${
            touch ? "min-h-touch rounded-panel px-3" : "h-field"
          }`}
        >
          <span className="text-sm text-ink-3">None saved</span>
          <a href="/settings/policies" className="text-sm font-medium text-accent">
            Add in Settings
          </a>
        </div>
      )}
    </div>
  );
}

export function ShippingFields({ listing, form, touch }) {
  const numIn = (field, label, w) => (
    <input
      type="number"
      min="0"
      inputMode="numeric"
      aria-label={label}
      value={listing[field] || ""}
      onChange={(e) => form.handleChange(field, e.target.value)}
      className={`${T.input(touch)} mono ${touch ? "min-w-0 flex-1" : w}`}
    />
  );
  const unit = touch ? "hint" : "text-sm text-ink-3";

  const weight = (
    <div className={touch ? "" : "flex-[0_1_auto]"}>
      <span className="fl">Package Weight</span>
      <div className="flex items-center gap-1.5">
        {numIn("weightLbs", "Pounds", "w-[58px]")}
        <span className={unit}>lbs</span>
        {numIn("weightOz", "Ounces", "w-[58px]")}
        <span className={unit}>oz</span>
      </div>
    </div>
  );
  const dims = (
    <div className={touch ? "" : "flex-[0_1_auto]"}>
      <span className="fl">Package Dimensions{touch ? " (in)" : ""}</span>
      <div className="flex items-center gap-1.5">
        {numIn("dimLength", "Length", "w-[52px]")}
        <span className={unit}>×</span>
        {numIn("dimWidth", "Width", "w-[52px]")}
        <span className={unit}>×</span>
        {numIn("dimHeight", "Height", "w-[52px]")}
        {!touch && <span className={unit}>in</span>}
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col ${touch ? "gap-3.5" : "gap-2.5 border-t border-line pt-3"}`}>
      {!touch && <h2 className="lbl">Shipping</h2>}
      <PolicySelect
        id="ship-pol"
        label="Shipping Policy"
        value={listing.shippingPolicyId}
        options={form.shippingPolicies}
        onChange={(v) => form.handleChange("shippingPolicyId", v)}
        touch={touch}
      />
      {touch ? (
        <>
          {weight}
          {dims}
        </>
      ) : (
        <div className="row row-end">
          {weight}
          {dims}
        </div>
      )}
      {/* Country of manufacture, read-only, on its own row so it never clips. */}
      <div>
        <label className="fl" htmlFor="origin">
          Item Origin
        </label>
        <span className="ro">
          <input
            id="origin"
            type="text"
            readOnly
            value={form.countryOfManufacture}
            placeholder="From Country/Region of Manufacture"
            className={T.input(touch)}
          />
          <LockIcon className="size-[15px]" />
        </span>
      </div>
      <div className={touch ? "flex flex-col gap-3.5" : "row"}>
        <PolicySelect
          id="pay-pol"
          label="Payment Policy"
          value={listing.paymentPolicyId}
          options={form.paymentPolicies}
          onChange={(v) => form.handleChange("paymentPolicyId", v)}
          touch={touch}
          inRow
        />
        <PolicySelect
          id="ret-pol"
          label="Return Policy"
          value={listing.returnPolicyId}
          options={form.returnPolicies}
          onChange={(v) => form.handleChange("returnPolicyId", v)}
          touch={touch}
          inRow
        />
      </div>
    </div>
  );
}
