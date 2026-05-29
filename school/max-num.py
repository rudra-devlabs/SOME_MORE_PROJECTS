numList = []
while True:
    num = input("Enter a number (Hit enter when done): ")
    try:
        numList.append(int(num))
    except:
        break

maximum = 0
for num in numList:
    if (num > maximum):
        maximum = num
print(f"Maximum number: {maximum}")