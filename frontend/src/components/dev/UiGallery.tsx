"use client";

import { useState } from "react";
import { PencilSimple, ShareNetwork } from "@phosphor-icons/react";

import { usePrefs, type Theme } from "@/lib/prefs";
import { formatMoney } from "@/lib/format";
import { Button, IconButton } from "@/components/ui/Button";
import { Chip, Field, MoneyInput, RadioRow, Segmented, Stepper } from "@/components/ui/Controls";
import { Menu } from "@/components/ui/Menu";
import { RunningNumber } from "@/components/ui/RunningNumber";
import { Sheet } from "@/components/ui/Sheet";
import { Signboard } from "@/components/ui/Signboard";
import { EmptyState, ErrorState, LoadingRows, Notice, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

const COLORS = [
  "paper", "paper-sunken", "ink", "ink-muted", "line", "line-strong",
  "sign-red", "sign-red-press", "sign-red-soft", "sign-red-text", "sign-blue", "sign-blue-soft",
  "wall-yellow", "wall-yellow-soft", "warn-ink", "moss", "moss-soft", "focus",
  "day-1", "day-2", "day-3", "day-4", "day-5", "cat-attraction", "cat-food", "cat-transport", "cat-other",
];
const TYPE = ["type-display-sign", "type-display", "type-h1", "type-h2", "type-h3", "type-body-read", "type-body", "type-small", "type-caption"];

/** Every base component in one place, in both themes (spec §9, P1). Dev only. */
export function UiGallery() {
  const { language, theme, setTheme } = usePrefs();
  const toast = useToast();
  const [budget, setBudget] = useState(3_000_000);
  const [people, setPeople] = useState(2);
  const [chips, setChips] = useState(["food"]);
  const [mode, setMode] = useState("walking");
  const [reason, setReason] = useState("too_expensive");
  const [sheet, setSheet] = useState(false);
  const [total, setTotal] = useState(2_850_000);

  return <div className="mx-auto max-w-5xl space-y-12 px-4 py-8 sm:px-6">
    <header className="space-y-4">
      <h1 className="type-h1">UI gallery</h1>
      <Segmented<Theme> label="Theme" value={theme} onChange={setTheme}
        options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
    </header>

    <Section title="Colour tokens">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {COLORS.map((name) => <li key={name} className="rounded-card border border-line p-2">
          <span className="block h-12 rounded-control border border-line" style={{ background: `var(--${name})` }} />
          <code className="type-caption mt-1 block">--{name}</code>
        </li>)}
      </ul>
    </Section>

    <Section title="Type scale">
      <div className="space-y-3">{TYPE.map((name) => <p key={name} className={name}>{name}: Hồ Hoàn Kiếm 2.850.000 đ</p>)}</div>
    </Section>

    <Section title="Signboard">
      <div className="grid gap-4 sm:grid-cols-2">
        <Signboard as="p" textClassName="type-display">Văn Miếu</Signboard>
        <Signboard as="p" tone="yellow" textClassName="type-display">Lễ hội</Signboard>
      </div>
    </Section>

    <Section title="Buttons">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary">Lập lịch trình</Button>
        <Button variant="ink">Tiếp tục</Button>
        <Button variant="secondary">Quay lại</Button>
        <Button variant="text">Sửa</Button>
        <Button variant="primary" loading loadingLabel="Đang lưu">Lưu</Button>
        <Button variant="secondary" disabled>Không dùng được</Button>
        <IconButton label="Chia sẻ"><ShareNetwork size={24} aria-hidden /></IconButton>
        <Menu label="Thêm thao tác" items={[{ label: "Sửa yêu cầu", onSelect: () => toast.show("Sửa yêu cầu"), icon: <PencilSimple size={20} aria-hidden /> }]} />
      </div>
    </Section>

    <Section title="Controls">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Ngân sách cả chuyến" htmlFor="g-budget" hint="Cả nhóm, đã gồm ăn uống và vé">
          <MoneyInput id="g-budget" value={budget} onChange={setBudget} language={language} describedById="g-budget-hint" />
        </Field>
        <Stepper id="g-people" label="Số người" value={people} min={1} max={20} onChange={setPeople} />
        <Field label="Điểm xuất phát" htmlFor="g-start" error="Nhập địa chỉ hoặc tên địa điểm ở Hà Nội">
          <input id="g-start" className="field" aria-invalid aria-describedby="g-start-error" defaultValue="ab" />
        </Field>
        <Segmented label="Phương tiện" value={mode} onChange={setMode}
          options={[{ value: "walking", label: "Đi bộ" }, { value: "motorbike", label: "Xe máy" }, { value: "car", label: "Ô tô" }]} />
        <fieldset>
          <legend className="mb-2 font-semibold">Sở thích</legend>
          <div className="flex flex-wrap gap-2">
            {[["food", "Ẩm thực"], ["history", "Lịch sử"], ["coffee", "Cà phê"]].map(([value, label]) =>
              <Chip key={value} selected={chips.includes(value)}
                onToggle={() => setChips((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])}>{label}</Chip>)}
            <Chip selected={false} onToggle={() => undefined} disabled>Không dùng được</Chip>
          </div>
        </fieldset>
        <div>
          {[["too_expensive", "Quá đắt", "Tìm điểm rẻ hơn gần đó"], ["too_far", "Quá xa", undefined]].map(([value, label, description]) =>
            <RadioRow key={value} name="g-reason" value={value!} checked={reason === value} onChange={setReason} label={label!} description={description} />)}
        </div>
      </div>
    </Section>

    <Section title="Feedback">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <LoadingRows rows={2} label="Đang tải" />
          <Notice tone="info">Giá và giờ có thể là ước tính.</Notice>
          <Notice>Đi bộ quá 10 km mỗi ngày.</Notice>
        </div>
        <div className="space-y-3">
          <EmptyState title="Chưa có chuyến đi nào" body="Lập lịch trình đầu tiên của bạn." action={<Button variant="primary">Lập lịch trình</Button>} />
          <ErrorState message="Không kết nối được máy chủ." onRetry={() => toast.show("Thử lại")} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <RunningNumber value={total} format={(value) => formatMoney(value, language)} className="type-h2 tnum" />
        <Button onClick={() => setTotal((value) => value - 250_000)}>Giảm 250.000 đ</Button>
        <Button onClick={() => toast.show("Đã thay Đền Bạch Mã", { tone: "success" })}>Hiện thông báo</Button>
        <Button onClick={() => setSheet(true)}>Mở sheet</Button>
      </div>
    </Section>

    <Sheet open={sheet} onClose={() => setSheet(false)} title="Thay địa điểm" footer={<Button variant="primary" className="w-full" onClick={() => setSheet(false)}>Thay địa điểm</Button>}>
      <p>Nội dung sheet. Esc, chạm nền hoặc kéo xuống để đóng.</p>
    </Sheet>
  </div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4"><h2 className="type-h2">{title}</h2>{children}</section>;
}
