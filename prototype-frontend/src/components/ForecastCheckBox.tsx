import { Checkbox } from "@/components/ui/checkbox";

const ForecastCheckBox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="forecast-lmp"
        checked={checked}
        onCheckedChange={onChange}
      />
      <label
        htmlFor="forecast-lmp"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        View LMP Forecast
      </label>
    </div>
  );
};

export default ForecastCheckBox;
