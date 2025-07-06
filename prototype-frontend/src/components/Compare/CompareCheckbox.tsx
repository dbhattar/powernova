import { Checkbox } from "../ui/checkbox";

export const CompareCheckbox = ({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => {
  return (
    <div className="flex flex-col flex-end items-end">
      <div className="flex items-center space-x-2 flex-end">
        <Checkbox
          id="terms"
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
        <label
          htmlFor="terms"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Compare
        </label>
      </div>
      {checked && <p>Select Point of Interconnections to compare</p>}
    </div>
  );
};
