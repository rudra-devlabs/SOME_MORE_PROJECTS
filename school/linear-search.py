numList = []
while True:
    num = input("Enter a number (Hit enter when done): ")
    try:
        numList.append(int(num))
    except:
        break

toFind = int(input("Enter the number to find: "))
for num in numList:
    if (num == toFind):
        print(f"The number at index: {numList.index(num)}")
if (toFind not in numList):
    print("The number is not present in the list of numbers!!!")